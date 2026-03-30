import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-24 text-center">
        
        <h1 className="text-5xl font-extrabold text-gray-800 leading-tight">
          SEEP
          <span className="block text-primary mt-2">
            Smart Exam Environment Portal
          </span>
        </h1>

        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          A modern platform designed for students and administrators to manage
          exams efficiently. Practice DSA, attempt MCQs, track results, and
          improve your coding skills in a smart and structured environment.
        </p>

        {/* Buttons */}
        <div className="mt-10 flex justify-center gap-4">
          <Link
            to="/login"
            className="px-6 py-3 bg-primary text-white font-semibold rounded-lg shadow-lg hover:scale-105 transition"
          >
            Get Started
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          
          <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition">
            <h3 className="text-xl font-semibold mb-2">MCQ Exams</h3>
            <p className="text-gray-600">
              Practice multiple choice questions with instant evaluation and
              detailed performance analytics.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition">
            <h3 className="text-xl font-semibold mb-2">DSA Challenges</h3>
            <p className="text-gray-600">
              Solve coding problems ranging from easy to hard and strengthen
              your data structures and algorithms skills.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition">
            <h3 className="text-xl font-semibold mb-2">Admin Dashboard</h3>
            <p className="text-gray-600">
              Manage exams, monitor participants, analyze results, and control
              the entire exam system from one place.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}