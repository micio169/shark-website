const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('database.sqlite');

// DB 테이블 초기화 (글 저장용)
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT,
    title TEXT,
    content TEXT,
    date TEXT
  )
`);

// 기본 패치노트 데이터가 없을 때만 샘플 데이터 삽입
const rowCount = db.prepare("SELECT COUNT(*) as count FROM posts").get();
if (rowCount.count === 0) {
    const insert = db.prepare("INSERT INTO posts (tag, title, content, date) VALUES (?, ?, ?, ?)");
    insert.run('patch', "웹사이트 BETA 버전 오픈!", "여기에는 '상어' 게임에 대한 여러 패치노트들이 올라올 예정입니다!", "2026.06.28");
}

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'earth-online-secret-key',
    resave: false,
    saveUninitialized: true
}));

function requireGM(req, res, next) {
    if (!req.session.user) {
        return res.status(403).json({ success: false, message: 'GM 로그인이 필요합니다.' });
    }
    next();
}

// [API] 로그인 상태 확인
app.get('/api/auth/status', (req, res) => {
    res.json({ loggedIn: !!req.session.user, user: req.session.user || null });
});

// [API] 로그인 요청 (ID: admin / PW: 1234 고정)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        req.session.user = username;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
});

// [API] 로그아웃 요청
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// [API] 글 목록 가져오기 (DB 조회)
app.get('/api/posts', (req, res) => {
    const posts = db.prepare("SELECT * FROM posts ORDER BY id DESC").all();
    res.json(posts);
});

// [API] 글 쓰기 (DB 저장 - 로그인 필수)
app.post('/api/posts', requireGM, (req, res) => {
    const { tag, title, content } = req.body;
    const safeTag = ['patch', 'event', 'notice'].includes(tag) ? tag : 'notice';
    const safeTitle = String(title || '').trim();
    const safeContent = String(content || '').trim();

    if (!safeTitle || !safeContent) {
        return res.status(400).json({ success: false, message: '제목과 내용을 입력해주세요.' });
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    
    const insert = db.prepare("INSERT INTO posts (tag, title, content, date) VALUES (?, ?, ?, ?)");
    insert.run(safeTag, safeTitle, safeContent, today);
    
    res.json({ success: true });
});

// [API] 글 삭제 (GM 로그인 필수)
app.delete('/api/posts/:id', requireGM, (req, res) => {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ success: false, message: '잘못된 글 번호입니다.' });
    }

    const result = db.prepare("DELETE FROM posts WHERE id = ?").run(postId);

    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '삭제할 글을 찾을 수 없습니다.' });
    }

    res.json({ success: true });
});

// server.js 파일 하단 수신(Listen) 부분 수정
const PORT = process.env.PORT || 3000; // Render가 주는 포트를 쓰고, 없으면 3000번 사용

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
