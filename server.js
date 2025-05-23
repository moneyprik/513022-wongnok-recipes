const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;
const session = require('express-session');
const multer = require('multer');

require('dotenv').config(); // Load .env
const config = require('./dbConfig'); // DB config

/////// manage Session
app.use(session({
  secret: 'wongn0k', 
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 5 * 60 * 1000 } 
}));

app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

/////// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

/////// API for Register
app.post('/api/register', async (req, res) => {
  console.log('Received register data:', req.body); // เช็คข้อมูลที่รับมา
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await sql.connect(config);

    await pool.request()
      .input('NAME', sql.NVarChar, name)
      .input('USERNAME', sql.NVarChar, username)
      .input('PASSWORD', sql.NVarChar, hashedPassword)
      .query(`
        INSERT INTO [dbo].[USER] ([NAME], [USERNAME], [PASSWORD])
        VALUES (@NAME, @USERNAME, @PASSWORD)
      `);

    res.status(200).json({ message: 'ลงทะเบียนสำเร็จ!' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลงทะเบียน', error: err.message });
  }
});

/////// For check connect Database
app.get('/api/test-db', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT 1 AS test');
    res.status(200).json({ success: true, message: 'เชื่อมต่อฐานข้อมูลสำเร็จ', result: result.recordset });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ success: false, message: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ', error: err.message });
  }
});

/////// API for login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('USERNAME', sql.NVarChar, username)
      .query('SELECT * FROM [dbo].[USER] WHERE USERNAME = @USERNAME');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'ไม่พบผู้ใช้' });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.PASSWORD);

    if (!isMatch) {
      return res.status(401).json({ message: 'Username หรือ รหัสผ่านไม่ถูกต้อง' });
    }

      req.session.user = {
      id: user.ID,
      name: user.NAME,
      username: user.USERNAME,
    };

    res.status(200).json({ name: user.NAME });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});


/////// API for logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'ออกจากระบบไม่สำเร็จ' });
    res.clearCookie('connect.sid');
    res.json({ message: 'ออกจากระบบแล้ว' });
  });
});


/////// Multer config for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/asset/image/menuadd');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

/////// API for Add new Receipt
app.post('/api/add-menu', upload.single('image'), async (req, res) => {
  const { name, type, ingredients, process, time, level } = req.body;
  const user = req.session.user;
    // Check session
  if (!user || !user.username) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const imagePath = `/asset/image/menuadd/${req.file.filename}`;
  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('type', sql.NVarChar, type)
      .input('image', sql.NVarChar, imagePath)
      .input('ingredients', sql.NVarChar, ingredients)
      .input('process', sql.NVarChar, process)
      .input('time', sql.NVarChar, time)
      .input('level', sql.NVarChar, level)
      .input('useradd', sql.NVarChar, user.username)
      .query(`INSERT INTO [dbo].[MENU_USER] 
        ([NAME_MENU], [TYPE_MENU], [IMAGE_MENU], [INGREDIENTS_MENU], [PROCESS_MENU], [TIME_MENU], [LEVEL_MENU], [ID_USERADD])
        VALUES (@name, @type, @image, @ingredients, @process, @time, @level, @useradd)`);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/////// API for show recipes that user add
app.get('/api/my-recipes', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('username', sql.NVarChar, user.username)
      .query('SELECT ID_MENU, NAME_MENU, IMAGE_MENU, INGREDIENTS_MENU, PROCESS_MENU, TIME_MENU, TYPE_MENU, LEVEL_MENU FROM MENU_USER WHERE ID_USERADD = @username');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching user recipes:', err);
    res.status(500).json({ message: 'Error fetching recipes' });
  }
});

/////// API for edit recipes that user add
app.post('/api/edit-menu', upload.single('image'), async (req, res) => {
  const { id, name, type, ingredients, process, time, level } = req.body;
  const user = req.session.user;
  const imagePath = req.file ? `/asset/image/menuadd/${req.file.filename}` : null;

  if (!user) return res.status(401).json({ success: false });

  try {
    const pool = await sql.connect(config);

    let query = `
      UPDATE MENU_USER SET 
        NAME_MENU = @name,
        TYPE_MENU = @type,
        INGREDIENTS_MENU = @ingredients,
        PROCESS_MENU = @process,
        TIME_MENU = @time,
        LEVEL_MENU = @level
        ${imagePath ? `, IMAGE_MENU = @imagePath` : ''}
      WHERE ID_MENU = @id AND ID_USERADD = @user
    `;

    const request = pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('type', sql.VarChar, type)
      .input('ingredients', sql.NVarChar, ingredients)
      .input('process', sql.NVarChar, process)
      .input('time', sql.VarChar, time)
      .input('level', sql.VarChar, level)
      .input('user', sql.NVarChar, user.username);

    if (imagePath) {
      request.input('imagePath', sql.NVarChar, imagePath);
    }

    await request.query(query);
    res.json({ success: true });
  } catch (err) {
    console.error('Edit failed:', err);
    res.status(500).json({ success: false });
  }
});

/////// API for Delete recipes that user add
app.delete('/api/my-recipes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('ID_MENU', sql.Int, id)
      .query('DELETE FROM MENU_USER WHERE ID_MENU = @ID_MENU');

    console.log('Rows affected:', result.rowsAffected);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.status(200).json({ message: 'Deleted successfully' });

  } catch (err) {
    // Log detailed info about the error for debugging
    console.error('❌ Delete error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

/////// API for show all recipes and for search
app.get('/api/menus', async (req, res) => {
  const { type, level, time, user, rating } = req.query;
 try {
    const pool = await sql.connect(config);
    const request = pool.request();

    request.input('type', sql.VarChar, type || null);
    request.input('level', sql.VarChar, level || null);
    request.input('time', sql.VarChar, time || null);
    request.input('user', sql.VarChar, user ? `%${user}%` : null);
    request.input('rating', sql.Int, rating ? parseInt(rating) : null);
    
    const result = await request.query(`
      SELECT 
        M.ID_MENU,
        M.NAME_MENU,
        M.TYPE_MENU,
        T.MENU_TYPE_DES,
        M.TIME_MENU,
        TM.TIME_DESCRIPTION,
        M.LEVEL_MENU,
        L.MENU_DESCRIPTION,
        M.IMAGE_MENU,
        ISNULL(AVG(S.SCORE_MENU), 0) AS SCORE
      FROM MENU_USER M
      LEFT JOIN MENU_TYPE T ON M.TYPE_MENU = T.MENU_CODE_TYPE
      LEFT JOIN MENU_TIME TM ON M.TIME_MENU = TM.TIME
      LEFT JOIN MENU_LEVEL L ON M.LEVEL_MENU = L.MENU_LEVEL
      LEFT JOIN MENU_SCORE S ON M.ID_MENU = S.ID_MENU
      WHERE 
        (@type IS NULL OR M.TYPE_MENU = @type) AND
        (@level IS NULL OR M.LEVEL_MENU = @level) AND
        (@time IS NULL OR M.TIME_MENU = @time) AND
        (
          @user IS NULL OR
          M.ID_USERADD LIKE @user
        )
      GROUP BY 
        M.ID_MENU, M.NAME_MENU, M.TYPE_MENU, T.MENU_TYPE_DES,
        M.TIME_MENU, TM.TIME_DESCRIPTION,
        M.LEVEL_MENU, L.MENU_DESCRIPTION, M.IMAGE_MENU
        HAVING (@rating IS NULL OR ISNULL(AVG(S.SCORE_MENU), 0) >= @rating)
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error('SQL Error:', err);
    res.status(500).json({ error: err.message });
  }
});


/////// API for show recipes that user select
app.get('/api/menu/:id', async (req, res) => {
  const id = req.params.id;
  const userId = req.session.user?.id || null;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          M.ID_MENU,
          M.NAME_MENU,
          M.TYPE_MENU,
          T.MENU_TYPE_DES,
          M.TIME_MENU,
          TM.TIME_DESCRIPTION,
          M.LEVEL_MENU,
          L.MENU_DESCRIPTION,
          M.INGREDIENTS_MENU,
          M.PROCESS_MENU,
          M.IMAGE_MENU,
          M.ID_USERADD,
          ISNULL(AVG(S.SCORE_MENU), 0) AS SCORE,
          -- Get current user's score on this menu if userId provided
          (SELECT TOP 1 SCORE_MENU FROM MENU_SCORE 
           WHERE ID_MENU = M.ID_MENU AND ID_USERADD = @userId) AS USER_SCORE
        FROM MENU_USER M
        LEFT JOIN MENU_TYPE T ON M.TYPE_MENU = T.MENU_CODE_TYPE
        LEFT JOIN MENU_TIME TM ON M.TIME_MENU = TM.TIME
        LEFT JOIN MENU_LEVEL L ON M.LEVEL_MENU = L.MENU_LEVEL
        LEFT JOIN MENU_SCORE S ON M.ID_MENU = S.ID_MENU
        WHERE M.ID_MENU = @id
        GROUP BY 
          M.ID_MENU, M.NAME_MENU, M.TYPE_MENU, T.MENU_TYPE_DES,
          M.TIME_MENU, TM.TIME_DESCRIPTION,
          M.LEVEL_MENU, L.MENU_DESCRIPTION,
          M.INGREDIENTS_MENU, M.PROCESS_MENU, M.IMAGE_MENU, M.ID_USERADD
      `);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/////// API for manage give score
app.post('/api/score', async (req, res) => {
  const { id_menu, score } = req.body;
  const user = req.session.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pool = await sql.connect(config);

    // Step 1: Check if the current user is the owner of the menu
    const ownerCheckResult = await pool.request()
      .input('id_menu', sql.Int, id_menu)
      .query(`SELECT ID_USERADD FROM MENU_USER WHERE ID_MENU = @id_menu`);

    const menuOwnerId = ownerCheckResult.recordset[0]?.ID_USERADD;
    console.log(menuOwnerId);
    console.log(user.id);
    if (!menuOwnerId) {
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }

    if (Number(menuOwnerId) === Number(user.username)) {
      return res.status(403).json({ error: 'ไม่สามารถให้คะแนนเมนูของตนเองได้' });
    }

    // Step 2: Save or update score
    await pool.request()
      .input('id_menu', sql.Int, id_menu)
      .input('id_user', sql.Int, user.id)
      .input('score', sql.Int, score)
      .query(`
        MERGE MENU_SCORE AS target
        USING (SELECT @id_menu AS ID_MENU, @id_user AS ID_USERADD) AS source
        ON target.ID_MENU = source.ID_MENU AND target.ID_USERADD = source.ID_USERADD
        WHEN MATCHED THEN
          UPDATE SET SCORE_MENU = @score
        WHEN NOT MATCHED THEN
          INSERT (ID_MENU, ID_USERADD, SCORE_MENU) VALUES (@id_menu, @id_user, @score);
      `);

    res.json({ message: 'คะแนนถูกบันทึกแล้ว' });
  } catch (err) {
    console.error('Error saving score:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

/////// API for fetch data for show in dropdown
app.get('/api/menu-type', async (req, res) => {
  const pool = await sql.connect(config);
  const result = await pool.request().query('SELECT MENU_CODE_TYPE, MENU_TYPE_DES FROM MENU_TYPE');
  res.json(result.recordset);
});

app.get('/api/menu-level', async (req, res) => {
  const pool = await sql.connect(config);
  const result = await pool.request().query('SELECT MENU_LEVEL, MENU_DESCRIPTION FROM MENU_LEVEL');
  res.json(result.recordset);
});

app.get('/api/menu-time', async (req, res) => {
  const pool = await sql.connect(config);
  const result = await pool.request().query('SELECT TIME, TIME_DESCRIPTION FROM MENU_TIME');
  res.json(result.recordset);
});


app.get('/api/users', async (req, res) => {
  const search = req.query.q || '';
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('search', sql.VarChar, `%${search}%`)
      .query(`
        SELECT DISTINCT ID_USERADD 
        FROM MENU_USER 
        WHERE ID_USERADD LIKE @search
        ORDER BY ID_USERADD
        OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('🔥 SQL Error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/menus/search", async (req, res) => {
  const searchQuery = req.query.q;

  if (!searchQuery) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input("query", sql.NVarChar, `%${searchQuery}%`)
      .query(`SELECT ID_MENU, NAME_MENU 
              FROM MENU_USER 
              WHERE NAME_MENU LIKE @query`);

    res.json(result.recordset);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.get("/api/menu", async (req, res) => {
  const id = req.query.id;
  const userId = req.session.user?.id || null;

  if (!id) {
    return res.status(400).json({ error: "Missing query parameter 'id'" });
  }

  try {
    const pool = await sql.connect(config);
    const request = pool.request()
      .input("id", sql.Int, id)
      .input("userId", sql.Int, userId); // even if null, define it

    const result = await request.query(`
      SELECT 
        M.ID_MENU,
        M.NAME_MENU,
        M.TYPE_MENU,
        T.MENU_TYPE_DES,
        M.TIME_MENU,
        TM.TIME_DESCRIPTION,
        M.LEVEL_MENU,
        L.MENU_DESCRIPTION,
        M.INGREDIENTS_MENU,
        M.PROCESS_MENU,
        M.IMAGE_MENU,
        M.ID_USERADD,
        ISNULL(AVG(S.SCORE_MENU), 0) AS SCORE,
        (SELECT TOP 1 SCORE_MENU 
         FROM MENU_SCORE 
         WHERE ID_MENU = M.ID_MENU AND ID_USERADD = @userId) AS USER_SCORE
      FROM MENU_USER M
      LEFT JOIN MENU_TYPE T ON M.TYPE_MENU = T.MENU_CODE_TYPE
      LEFT JOIN MENU_TIME TM ON M.TIME_MENU = TM.TIME
      LEFT JOIN MENU_LEVEL L ON M.LEVEL_MENU = L.MENU_LEVEL
      LEFT JOIN MENU_SCORE S ON M.ID_MENU = S.ID_MENU
      WHERE M.ID_MENU = @id
      GROUP BY 
        M.ID_MENU, M.NAME_MENU, M.TYPE_MENU, T.MENU_TYPE_DES,
        M.TIME_MENU, TM.TIME_DESCRIPTION, M.LEVEL_MENU, L.MENU_DESCRIPTION,
        M.INGREDIENTS_MENU, M.PROCESS_MENU, M.IMAGE_MENU, M.ID_USERADD
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Menu not found" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Fetch menu error:", err); // This will show the actual error in your server logs
    res.status(500).json({ error: "Fetch failed" });
  }
});



// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
