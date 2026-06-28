let allPosts = []; // 서버에서 받아온 글 목록 임시 저장
let isGM = false;

// 페이지 로드 시 실행
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuthStatus();
    await loadPosts();
});

// 1. 로그인 상태 체크 및 UI 변경
async function checkAuthStatus() {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    isGM = data.loggedIn;
    
    const authZone = document.getElementById('auth-zone');
    const writeTriggerZone = document.getElementById('write-trigger-zone');

    if (data.loggedIn) {
        authZone.innerHTML = `<span style="margin-right:15px; color:#fff;">Welcome, GM</span><button class="btn-auth" onclick="handleLogout()">로그아웃</button>`;
        writeTriggerZone.style.display = 'block'; // 글쓰기 버튼 활성화
    } else {
        authZone.innerHTML = `<button class="btn-auth" onclick="toggleLoginModal(true)">GM 로그인</button>`;
        writeTriggerZone.style.display = 'none';
    }
}

// 2. 서버에서 글 가져와 화면에 그리기
async function loadPosts() {
    const res = await fetch('/api/posts');
    allPosts = await res.json();
    
    const gridTarget = document.getElementById('news-grid-target');
    gridTarget.innerHTML = ''; // 초기화

    if (allPosts.length === 0) {
        gridTarget.innerHTML = '<p class="empty-news">등록된 소식이 없습니다.</p>';
        return;
    }

    allPosts.forEach((post, index) => {
        // 이미지 다양성을 위해 인덱스 활용
        const imgId = 10 + (post.id % 10);
        const tag = normalizeTag(post.tag);
        const cardHtml = `
            <div class="news-card" onclick="openDetailModal(${index})">
                <div class="news-thumb" style="background-image: url('https://picsum.photos/800/450?random=${imgId}');">
                    <span class="news-tag ${tag}">${translateTag(tag)}</span>
                    ${isGM ? `
                        <button class="delete-post-btn" onclick="handleDeletePost(event, ${post.id})" title="공지 삭제" aria-label="공지 삭제">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="news-body">
                    <h3 class="news-title">${escapeHtml(post.title)}</h3>
                    <div class="news-footer">
                        <span class="news-date">${escapeHtml(post.date)}</span>
                        <span style="color:var(--primary-color)">Read More →</span>
                    </div>
                </div>
            </div>
        `;
        gridTarget.innerHTML += cardHtml;
    });
}

// 3. 로그인 처리
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-id').value;
    const password = document.getElementById('login-pw').value;

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
        toggleLoginModal(false);
        await checkAuthStatus();
        await loadPosts();
    } else {
        alert(data.message);
    }
}

// 4. 로그아웃 처리
async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await checkAuthStatus();
    await loadPosts();
}

// 5. 글 등록 처리
async function handleWrite(e) {
    e.preventDefault();
    const tag = document.getElementById('post-tag').value;
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;

    const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, title, content })
    });
    const data = await res.json();

    if (data.success) {
        document.getElementById('write-form').reset();
        toggleWriteModal(false);
        await loadPosts(); // 게시글 새로고침
    } else {
        alert(data.message);
    }
}

// 6. 글 삭제 처리
async function handleDeletePost(event, postId) {
    event.stopPropagation();

    if (!isGM) {
        alert('GM 로그인 후 삭제할 수 있습니다.');
        return;
    }

    const post = allPosts.find((item) => item.id === postId);
    const postTitle = post ? post.title : '선택한 글';

    if (!confirm(`"${postTitle}" 공지를 삭제할까요?\n삭제 후에는 되돌릴 수 없습니다.`)) {
        return;
    }

    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
        toggleDetailModal(false);
        await loadPosts();
        return;
    }

    if (res.status === 403) {
        await checkAuthStatus();
        await loadPosts();
    }

    alert(data.message || '삭제 중 문제가 발생했습니다.');
}

// 6. 글 상세 보기 열기
function openDetailModal(index) {
    const post = allPosts[index];
    const target = document.getElementById('detail-target');
    const tag = normalizeTag(post.tag);
    
    target.innerHTML = `
        <div class="detail-topline">
            <span class="news-tag ${tag}" style="position:static">${translateTag(tag)}</span>
            ${isGM ? `
                <button class="detail-delete-btn" onclick="handleDeletePost(event, ${post.id})">
                    <i class="fa-solid fa-trash"></i> 삭제
                </button>
            ` : ''}
        </div>
        <h1 style="font-size: 28px; margin: 15px 0 5px 0; color:#fff;">${escapeHtml(post.title)}</h1>
        <p style="color:var(--gray); font-size:14px; margin-bottom:20px;">등록일: ${escapeHtml(post.date)} | 작성자: 개발팀</p>
        <hr style="border:0; height:1px; background:rgba(255,255,255,0.1); margin-bottom:20px;">
        <div style="line-height:1.8; font-size:16px; white-space: pre-wrap; color:#e0e0e0;">${escapeHtml(post.content)}</div>
    `;
    toggleDetailModal(true);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function normalizeTag(tag) {
    return ['patch', 'event', 'notice'].includes(tag) ? tag : 'notice';
}

// 태그 변환기
function translateTag(tag) {
    if(tag === 'patch') return '패치노트';
    if(tag === 'event') return '이벤트';
    return '공지사항';
}

// 모달 토글 유틸리티 함수들
function toggleLoginModal(show) { document.getElementById('loginModal').style.display = show ? 'flex' : 'none'; }
function toggleWriteModal(show) { document.getElementById('writeModal').style.display = show ? 'flex' : 'none'; }
function toggleDetailModal(show) { document.getElementById('detailModal').style.display = show ? 'flex' : 'none'; }
