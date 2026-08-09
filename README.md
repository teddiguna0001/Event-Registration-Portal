Event Portal

Complete event management system for university tech communities. Students browse events, register with GITAM email, receive QR codes. Organisers add events, scan QR codes for instant check-in, track attendance. Self-contained web app with persistent storage, camera QR scanning, and admin dashboard. No backend required.

🚀 Quick Start
Open index.html in any modern browser

Browse events → Register → Get QR code

📁 File Structure
text
├── index.html      # Main HTML structure
├── style.css       # Complete styles
├── script.js       # All JavaScript logic
└── README.md       # Documentation
✨ Features
For Students
Browse upcoming events with details

Register using GITAM email

Receive unique QR code for check-in

View event attachments

For Organisers
Add, edit, and remove events

Upload event images and documents

Scan QR codes via camera

Manual check-in with registration ID

View all registrations with attendance status

🔐 Admin Access
Field	Value
Username	Any email ending with @student.gitam.edu
Password	Gitam$$456
🛠️ Tech Stack
HTML5, CSS3, JavaScript (ES6+)

QRCode.js – QR generation

jsQR – QR decoding via camera

Browser Storage API – persistence

Google Fonts – Chakra Petch, Inter, JetBrains Mono

📦 Dependencies
All loaded via CDN:

QRCode.js: cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js

jsQR: cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js

🎯 Use Cases
University hackathons

Tech workshops & meetups

Open source community events

Student organisation gatherings

🔒 Security Notes
Admin password is hardcoded – change before production

Storage is browser-based – not for sensitive data

Email validation ensures GITAM domains only

📝 License
MIT – Free to use, modify, and distribute.
