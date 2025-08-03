const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const sendEmail = async (to, subject, html, text = null) => {
    try {
        // For demo purposes, just log the email instead of actually sending
        console.log('📧 Email would be sent to:', to);
        console.log('📧 Subject:', subject);
        console.log('📧 Content:', text || html.replace(/<[^>]*>/g, '').substring(0, 100) + '...');
        
        // In production, uncomment the actual email sending code below:
        /*
        const mailOptions = {
            from: `"FoodConnect Malaysia" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
        */
        
        return { success: true, messageId: 'demo-' + Date.now() };
    } catch (error) {
        console.error('📧 Email send error:', error);
        return { success: false, error: error.message };
    }
};

const sendWelcomeEmail = async (email, name, userType) => {
    const subject = 'Welcome to FoodConnect Malaysia!';
    const html = `
        <h2>Welcome to FoodConnect Malaysia, ${name}!</h2>
        <p>Thank you for joining our platform as a ${userType}.</p>
        <p>Your account is currently under review and will be activated once approved by our team.</p>
        <p>You will receive another email once your account is approved.</p>
        <br>
        <p>Best regards,<br>FoodConnect Malaysia Team</p>
    `;
    
    return await sendEmail(email, subject, html);
};

const sendApprovalEmail = async (email, name, userType) => {
    const subject = 'Your FoodConnect Malaysia Account Has Been Approved!';
    const html = `
        <h2>Congratulations, ${name}!</h2>
        <p>Your ${userType} account has been approved and is now active.</p>
        <p>You can now log in to your account and start using FoodConnect Malaysia.</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">Login to your account</a></p>
        <br>
        <p>Best regards,<br>FoodConnect Malaysia Team</p>
    `;
    
    return await sendEmail(email, subject, html);
};

module.exports = {
    transporter,
    sendEmail,
    sendWelcomeEmail,
    sendApprovalEmail,
};