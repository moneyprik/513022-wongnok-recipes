# 513022-wongnok-recipes
# Full stack website for sharing recipe , User can share and manage own recipes with other people in the world.
# Stack that I use
  - Frontend: HTML, Tailwind CSS, JavaScript
  - Backend: Node.js + Express.js
  - Database: Microsoft SQL Server
  - Authentication: Session-based login
  - Demo Deployment on IIS server
# Features
  - User authentication (login/logout)
  - Add and manage recipes with:
    * Image upload
    * Ingredients
    * Cooking process
    * Time and difficulty level
    * Filter by type, time, level, or user
    * Rate and review recipes
    * Image upload & storage
# Project Structure
├── public/                 # Frontend files
│   ├── index.html          # Homepage
│   ├── register.html       # User registration page
│   ├── manage.html         # Recipe management UI
│   └── asset/image/        # Uploaded images
├── server.js               # Node.js backend (Express app)
├── dbConfig.js             # SQL Server DB config
├── .env                    # Environment variables
└── web.config              # IIS setting
# How to setup this Project
  1. Clone this project to your local by use command:
     - git clone https://your-repo-url.git
     - cd wongnok-recipe
  2. Install dependencies by use command : npm install
  3. Create a .env file and define details for your database connection
  4. run cmd command node server.js in root directory
  5. Access via url that you run server in browser 
# วิธี run ตัว Demo เข้าผ่าน url(ผ่าน VDI หรือ เน็ตไฟฟ้า) : http://peameter-web.pea.co.th/node-api/
# Author Developed By Kit Phonrit
