import React from 'react';

const AboutContact = () => {
  return (
    <div className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-8 text-center">About Us & Contact</h1>

      {/* About Us Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Our Story</h2>
        <p className="text-lg text-gray-700 mb-4">
          Hey there! We’re <strong>Reethu</strong> and <strong>Shreyas</strong> — two developers with a shared passion for building things that actually make collaboration easier.
        </p>
        <p className="text-lg text-gray-700 mb-4">
          The idea for <strong>CodeSphere</strong> sparked during a hackathon where we found ourselves constantly stumbling over code merges, sync issues, and unclear ownership during a tight deadline sprint. We spent more time fighting with our tools than focusing on building something meaningful.
        </p>
        <p className="text-lg text-gray-700 mb-4">
          That frustrating (but enlightening) experience lit a fire in us to create a platform that simplifies real-time coding collaboration — something intuitive, responsive, and tailored to the needs of modern teams and indie devs alike. CodeSphere is our answer to that challenge.
        </p>
        <p className="text-lg text-gray-700">
          Our goal? To make remote pair programming and team coding sessions feel like you're sitting side-by-side — minus the merge conflicts and chaos.
        </p>
      </section>

      {/* Contact Us Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Get In Touch</h2>
        <p className="text-lg text-gray-700 mb-4">
          We’d love to hear from you — whether it’s feedback, collaboration ideas, feature requests, or just to say hi!
        </p>
        <p className="text-lg text-gray-700 mb-2">
          You can reach out to us directly at:
        </p>
        <ul className="text-lg text-gray-700 list-disc list-inside mb-4">
          <li>Email: <a href="mailto:reethu.thota@gmail.com" className="text-blue-600 hover:underline">reethu.thota@gmail.com</a> or <a href="mailto:shreyasrajiv327@gmail.com" className="text-blue-600 hover:underline">shreyasrajiv327@gmail.com</a></li>
          <li>GitHub: <a href="https://github.com/reethuthota/collaborative-code-editor" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">CodeSphereCollab</a></li>
        </ul>
        <p className="text-lg text-gray-700">
          We’re always excited to connect with other builders. Let’s shape the future of collaborative coding together.
        </p>
      </section>
    </div>
  );
};

export default AboutContact;
