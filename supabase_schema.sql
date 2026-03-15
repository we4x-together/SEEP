-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('MCQ', 'DSA')),
  duration INTEGER NOT NULL, -- minutes
  total_questions INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  max_attempts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Questions table (Public Info)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'dsa')),
  question TEXT NOT NULL,
  options JSONB, -- Array of strings for MCQ
  points INTEGER NOT NULL DEFAULT 1,
  code_template TEXT, -- For DSA
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Question Answers table (Private Info - Admin Only)
CREATE TABLE question_answers (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  correct_answer INTEGER, -- Index of correct option for MCQ
  test_cases JSONB, -- Array of {input, output, is_hidden} for DSA
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Exam Attempts table
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out')),
  UNIQUE(user_id, exam_id, started_at)
);

-- 6. User Results table
CREATE TABLE user_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  percentage FLOAT NOT NULL,
  time_taken INTEGER NOT NULL, -- seconds
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  answers JSONB -- Store user answers for review [{question_id, answer, is_correct}]
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_results ENABLE ROW LEVEL SECURITY;

-- 7. Policies

-- Profiles: Users can read all profiles (to see names), but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Exams: Anyone authenticated can read active exams
CREATE POLICY "Anyone can read active exams" ON exams
  FOR SELECT USING (
    (auth.role() = 'authenticated' AND status = 'active')
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  );

-- Exams: Admins can do everything
CREATE POLICY "Admins can manage exams" ON exams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Questions: Anyone authenticated can read questions for an active exam
CREATE POLICY "Anyone can read questions" ON questions
  FOR SELECT USING (
    (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM exams WHERE exams.id = questions.exam_id AND exams.status = 'active'
    ))
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  );

-- Questions: Admins can manage questions
CREATE POLICY "Admins can manage questions" ON questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Question Answers: ONLY Admins can read or manage
CREATE POLICY "Admins can manage answers" ON question_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Exam Attempts: Users can manage their own attempts
CREATE POLICY "Users can manage own attempts" ON exam_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all attempts" ON exam_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Results: Users can read their own results
CREATE POLICY "Users can read own results" ON user_results
  FOR SELECT USING (
    auth.uid() = user_id
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  );

-- Results: Users can insert their own results
CREATE POLICY "Users can insert own results" ON user_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Results: Admins can manage all results
CREATE POLICY "Admins can manage results" ON user_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 8. Functions & Triggers for Automation

-- Function to automatically calculate total questions/points for an exam
CREATE OR REPLACE FUNCTION update_exam_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE exams
    SET 
      total_questions = (SELECT count(*) FROM questions WHERE exam_id = NEW.exam_id),
      total_points = (SELECT COALESCE(sum(points), 0) FROM questions WHERE exam_id = NEW.exam_id)
    WHERE id = NEW.exam_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE exams
    SET 
      total_questions = (SELECT count(*) FROM questions WHERE exam_id = OLD.exam_id),
      total_points = (SELECT COALESCE(sum(points), 0) FROM questions WHERE exam_id = OLD.exam_id)
    WHERE id = OLD.exam_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_question_change
  AFTER INSERT OR UPDATE OR DELETE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_exam_totals();

-- 9. Secure Exam Submission Function
CREATE OR REPLACE FUNCTION submit_exam(p_exam_id UUID, p_answers JSONB, p_time_taken INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_score INTEGER := 0;
  v_total_points INTEGER := 0;
  v_percentage FLOAT;
  v_status TEXT;
  v_q_record RECORD;
  v_ans_record RECORD;
  v_result_id UUID;
  v_attempt_id UUID;
  v_final_answers JSONB := '[]'::jsonb;
  v_is_correct BOOLEAN;
  v_points INTEGER;
BEGIN
  -- 1. Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Create or find in-progress attempt
  SELECT id INTO v_attempt_id 
  FROM exam_attempts 
  WHERE user_id = v_user_id AND exam_id = p_exam_id AND status = 'in_progress'
  ORDER BY started_at DESC LIMIT 1;

  IF v_attempt_id IS NULL THEN
    INSERT INTO exam_attempts (exam_id, user_id, status)
    VALUES (p_exam_id, v_user_id, 'completed')
    RETURNING id INTO v_attempt_id;
  ELSE
    UPDATE exam_attempts 
    SET status = 'completed', completed_at = NOW() 
    WHERE id = v_attempt_id;
  END IF;

  -- 3. Calculate score
  FOR v_q_record IN SELECT id, points, type FROM questions WHERE exam_id = p_exam_id LOOP
    v_total_points := v_total_points + v_q_record.points;
    v_is_correct := FALSE;
    v_points := 0;

    -- Get correct answer
    SELECT correct_answer INTO v_ans_record FROM question_answers WHERE question_id = v_q_record.id;

    -- Check user answer (p_answers is {question_id: answer_index})
    -- v_q_record.id is UUID, must cast to text for JSONB lookup
    IF (p_answers->>(v_q_record.id::text))::integer = v_ans_record.correct_answer THEN
      v_score := v_score + v_q_record.points;
      v_is_correct := TRUE;
      v_points := v_q_record.points;
    END IF;

    -- Record final answer details for review
    v_final_answers := v_final_answers || jsonb_build_object(
      'question_id', v_q_record.id,
      'answer', (p_answers->>(v_q_record.id::text))::integer,
      'correct_answer', v_ans_record.correct_answer,
      'is_correct', v_is_correct,
      'points', v_points
    );

  END LOOP;

  -- 4. Final calculations
  IF v_total_points > 0 THEN
    v_percentage := (v_score::float / v_total_points::float) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  v_status := CASE WHEN v_percentage >= 40 THEN 'passed' ELSE 'failed' END;

  -- 5. Insert result
  INSERT INTO user_results (
    attempt_id, exam_id, user_id, score, total_points, 
    percentage, time_taken, status, answers
  ) VALUES (
    v_attempt_id, p_exam_id, v_user_id, v_score, v_total_points,
    v_percentage, p_time_taken, v_status, v_final_answers
  ) RETURNING id INTO v_result_id;

  -- 6. Return summary
  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'total_points', v_total_points,
    'percentage', v_percentage,
    'status', v_status,
    'detailed_answers', v_final_answers
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
