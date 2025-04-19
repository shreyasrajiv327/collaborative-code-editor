import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-inter text-gray-900">
      {/* Hero Section */}
      <section className="py-20 md:py-32 text-center">
        <div className="container mx-auto px-6 max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            CodeSphere: Your Coding Universe
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
            Write, collaborate, and deploy code seamlessly. CodeSphere combines a
            powerful IDE, GitHub integration, and team tools in one place.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 transition"
            >
              Get Started
            </button>
            <button
              onClick={() => navigate('/login')}
              className="border border-gray-900 text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition"
            >
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Everything You Need to Code
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <svg
                className="w-10 h-10 mb-4 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                ></path>
              </svg>
              <h3 className="text-xl font-semibold mb-2">Code Anywhere</h3>
              <p className="text-gray-600">
                Our cloud-based IDE supports JavaScript, Python, Java, and more,
                with real-time execution powered by Judge0.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <svg
                className="w-10 h-10 mb-4 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                ></path>
              </svg>
              <h3 className="text-xl font-semibold mb-2">Collaborate Seamlessly</h3>
              <p className="text-gray-600">
                Work with your team in real-time, manage GitHub repositories, and
                add collaborators effortlessly.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <svg
                className="w-10 h-10 mb-4 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
              <h3 className="text-xl font-semibold mb-2">Instant Feedback</h3>
              <p className="text-gray-600">
                Run code and get instant results, with detailed error messages and
                output to streamline your workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 text-center">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Start Building Today
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join a community of developers creating the future. CodeSphere is free
            to start, with powerful tools for every coder.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-gray-900 text-white px-8 py-3 rounded-md font-medium hover:bg-gray-700 transition"
          >
            Try CodeSphere Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-4">© 2025 CodeSphere. All rights reserved.</p>
          <div className="flex justify-center gap-6 text-sm">
            <a href="/about" className="hover:text-white transition">
              About
            </a>
            <a href="/contact" className="hover:text-white transition">
              Contact
            </a>
            <a href="/privacy" className="hover:text-white transition">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white transition">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;