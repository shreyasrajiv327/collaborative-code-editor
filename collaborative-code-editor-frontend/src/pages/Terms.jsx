import React from 'react';

const Terms = () => {
  return (
    <div className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
      <p className="text-lg text-gray-600 mb-6">
        Welcome to CodeSphere! By using our platform, you agree to the following terms and conditions. Please read them carefully.
      </p>
      
      <h2 className="text-2xl font-semibold mt-6 mb-4">1. Acceptance of Terms</h2>
      <p className="text-lg text-gray-600 mb-4">
        By accessing and using CodeSphere, you agree to comply with these Terms and Conditions. If you do not agree to these terms, please refrain from using our platform. CodeSphere reserves the right to update or modify these terms at any time, so please check this page regularly for changes.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">2. User Account</h2>
      <p className="text-lg text-gray-600 mb-4">
        To use CodeSphere, you must create a user account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">3. User Conduct</h2>
      <p className="text-lg text-gray-600 mb-4">
        As a user of CodeSphere, you agree to:
      </p>
      <ul className="list-disc pl-6 text-lg text-gray-600 mb-4">
        <li>Use the platform for lawful purposes only.</li>
        <li>Not engage in activities that could damage, disable, overburden, or impair the platform.</li>
        <li>Respect the intellectual property rights of other users and third parties.</li>
        <li>Not upload, share, or transmit any harmful or illegal content, including but not limited to viruses, malware, or offensive material.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-6 mb-4">4. CodeSphere's Rights</h2>
      <p className="text-lg text-gray-600 mb-4">
        CodeSphere reserves the right to:
      </p>
      <ul className="list-disc pl-6 text-lg text-gray-600 mb-4">
        <li>Modify or discontinue the platform at any time without prior notice.</li>
        <li>Restrict, suspend, or terminate your access to the platform for violating these terms.</li>
        <li>Monitor user activity and content to ensure compliance with these terms and applicable laws.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-6 mb-4">5. Privacy and Data Protection</h2>
      <p className="text-lg text-gray-600 mb-4">
        Your privacy is important to us. Our Privacy Policy outlines how we collect, use, and protect your personal information. By using CodeSphere, you consent to our data collection practices as described in our Privacy Policy. You agree not to hold CodeSphere responsible for any unauthorized access to your personal data.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">6. Intellectual Property</h2>
      <p className="text-lg text-gray-600 mb-4">
        All content on CodeSphere, including text, graphics, logos, and software, is the property of CodeSphere or its licensors and is protected by intellectual property laws. You agree not to use, copy, or distribute any part of the platform's content without prior authorization.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">7. Limitation of Liability</h2>
      <p className="text-lg text-gray-600 mb-4">
        CodeSphere is not responsible for any direct, indirect, incidental, or consequential damages arising from your use or inability to use the platform. We do not guarantee that the platform will be error-free, secure, or continuously available. You use the platform at your own risk.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">8. Termination of Service</h2>
      <p className="text-lg text-gray-600 mb-4">
        CodeSphere reserves the right to suspend or terminate your account if we believe you have violated these Terms and Conditions. Upon termination, your access to the platform will be revoked, and any content you have uploaded may be deleted, subject to applicable laws.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">9. Governing Law</h2>
      <p className="text-lg text-gray-600 mb-4">
        These Terms and Conditions are governed by the laws of the jurisdiction in which CodeSphere operates. Any legal actions related to these terms will be conducted in the appropriate courts within that jurisdiction.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">10. Dispute Resolution</h2>
      <p className="text-lg text-gray-600 mb-4">
        In the event of a dispute, we encourage users to contact us directly to resolve the matter. If the dispute cannot be resolved amicably, it will be subject to mediation or arbitration, depending on the jurisdiction where CodeSphere is incorporated.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-4">11. Changes to Terms</h2>
      <p className="text-lg text-gray-600 mb-4">
        CodeSphere may update these Terms and Conditions from time to time. We will notify users of any significant changes via email or through the platform. Your continued use of CodeSphere after such updates will constitute acceptance of the revised terms.
      </p>

      <p className="text-lg text-gray-600 mt-6">
        If you have any questions regarding these Terms and Conditions, please contact us at{' '}
        <a href="mailto:reethu.thota@gmail.com" className="text-blue-600 hover:underline">reethu.thota@gmail.com</a> or <a href="mailto:shreyasrajiv327@gmail.com" className="text-blue-600 hover:underline">shreyasrajiv327@gmail.com</a>
      </p>
    </div>
  );
};

export default Terms;
