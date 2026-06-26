import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  where, 
  query, 
  onSnapshot, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  orderBy, 
  limit,
  writeBatch,
  deleteField,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = window.SUMIT_FIREBASE_CONFIG;
const adminPasswordHash = window.SUMIT_ADMIN_PASSWORD_HASH;

let app, db;

// 층 이름 헬퍼 함수
function getFloorText(floorValue) {
  switch(floorValue) {

    case 'floor2': return '2층(썸잇)';
    default: return floorValue;
  }
}

function getFloorFullName(floorValue) {
  switch(floorValue) {
    case 'floor2': return '2층 (썸잇)';
    default: return floorValue;
  }
}

function getFloorColor(floorValue) {
  switch(floorValue) {
    case 'floor2': return '#64c8ff';
    default: return '#999';
  }
}

try {
  if(!firebaseConfig) throw new Error('Firebase configuration is missing');
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('Firebase initialized successfully');
} catch(err) {
  console.error('Firebase initialization error:', err);
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getParticipantDisplayName(p) {
  const nicknameValue = String(p?.nickname || '').trim();
  const realNameValue = String(p?.realName || '').trim();
  return nicknameValue || realNameValue || '닉네임 없음';
}

function getParticipantDedupeKey(p) {
  return `${String(p?.floor || 'floor2')}|${String(p?.gender || '')}|${getParticipantDisplayName(p).toLowerCase()}`;
}

function isBetterParticipantRecord(candidate, current) {
  const candidateTable = candidate.currentTable || candidate.tableNumber;
  const currentTable = current.currentTable || current.tableNumber;
  if(Boolean(candidateTable) !== Boolean(currentTable)) return Boolean(candidateTable);
  if(Boolean(candidate.nickname) !== Boolean(current.nickname)) return Boolean(candidate.nickname);
  return (candidate.updated || candidate.joined || 0) > (current.updated || current.joined || 0);
}

async function cleanupDuplicateParticipantsForFloor(targetFloor = 'floor2') {
  try {
    const snap = await getDocs(query(collection(db, 'participants'), where('floor', '==', targetFloor)));
    const canonical = {};
    const duplicateRefs = [];
    snap.forEach(d => {
      const data = d.data();
      if(data.isStaff) return;
      const key = getParticipantDedupeKey(data);
      if(!key.includes('|male|') && !key.includes('|female|')) return;
      if(!canonical[key]) {
        canonical[key] = { id: d.id, ref: d.ref, data };
        return;
      }
      const previous = canonical[key];
      if(isBetterParticipantRecord(data, previous.data)) {
        duplicateRefs.push(previous.ref);
        canonical[key] = { id: d.id, ref: d.ref, data };
      } else {
        duplicateRefs.push(d.ref);
      }
    });
    if(duplicateRefs.length === 0) return;
    const batch = writeBatch(db);
    duplicateRefs.slice(0, 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  } catch(e) {
    console.warn('Duplicate participant cleanup skipped:', e);
  }
}

// UI 요소들
const entry = document.getElementById('entry');
const main = document.getElementById('main');
const nickInput = document.getElementById('nick');
const realNameInput = document.getElementById('realName');
const ageInput = document.getElementById('age');
const phoneNumberInput = document.getElementById('phoneNumber');
const genderSelect = document.getElementById('gender');
const secondPartyCheckbox = document.getElementById('second_party');
const enterBtn = document.getElementById('enterBtn');

const oppositeList = document.getElementById('oppositeList');
const finalList = document.getElementById('finalList');
const cupidList = document.getElementById('cupidList');
const noteMsg = document.getElementById('noteMsg');
const finalPickBtn = document.getElementById('finalPickBtn');
const cupidBtn = document.getElementById('cupidBtn');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const songBtn = document.getElementById('songBtn');
const sosBtn = document.getElementById('sosBtn');
const sosReason = document.getElementById('sosReason');
const announcements = document.getElementById('announcements');
const greeting = document.getElementById('greeting');
const farewell = document.getElementById('farewell');
const leaveBtn = document.getElementById('leaveBtn');
const newNickInput = document.getElementById('newNickInput');
const changeNickBtn = document.getElementById('changeNickBtn');
const changeTableSelect = document.getElementById('changeTableSelect');
const changeTableBtn = document.getElementById('changeTableBtn');
const currentTableDisplay = document.getElementById('currentTableDisplay');
const floorSelect = document.getElementById('floor');
const tableNumberSelect = document.getElementById('tableNumberSelect');


const adminFloorSelect = document.getElementById('adminFloor');
const adminPw = document.getElementById('adminPw');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminPanel = document.getElementById('adminPanel');

const adminParticipants = document.getElementById('adminParticipants');
const adminNotes = document.getElementById('adminNotes');
const adminSOS = document.getElementById('adminSOS');
const adminSongs = document.getElementById('adminSongs');
const adminStories = document.getElementById('adminStories');
const adminCupid = document.getElementById('adminCupid');
const adminCouples = document.getElementById('adminCouples');
const adminFinal = document.getElementById('adminFinal');
const adminMatching = document.getElementById('adminMatching');
const clearAllBtn = document.getElementById('clearAllBtn');
const removeAllParticipantsBtn = document.getElementById('removeAllParticipantsBtn');
const adminDailyPinEl = document.getElementById('adminDailyPin');
const adminPinDateEl = document.getElementById('adminPinDate');
const regenPinBtn = document.getElementById('regenPinBtn');
const entryPinInput = document.getElementById('entryPin');
if(entryPinInput) {
  entryPinInput.addEventListener('input', () => {
    if(entryPinInput.value.replace(/\D/g,'').length >= 4) {
      setTimeout(() => enterBtn && enterBtn.click(), 80);
    }
  });
}

const DAILY_PIN_DOC = 'dailyPin';

const cupidNotifications = document.getElementById('cupidNotifications');
const conversationTopic = document.getElementById('conversationTopic');
const getConversationBtn = document.getElementById('getConversationBtn');
const storyContent = document.getElementById('storyContent');
const sendStoryBtn = document.getElementById('sendStoryBtn');
const storySection = document.getElementById('storySection');
const finalCard = document.getElementById('finalCard');
const vote3rdSection = document.getElementById('vote3rdSection');
const popularityList = document.getElementById('popularityList');
const popularityBtn = document.getElementById('popularityBtn');
const myPopularity = document.getElementById('myPopularity');

const timerDisplay = document.getElementById('timerDisplay');
const timerText = document.getElementById('timerText');
const timerMinutes = document.getElementById('timerMinutes');
const startTimerBtn = document.getElementById('startTimerBtn');
const stopTimerBtn = document.getElementById('stopTimerBtn');
const adminTimerStatus = document.getElementById('adminTimerStatus');
const startSecondPartBtn = document.getElementById('startSecondPartBtn');
const stopSecondPartBtn = document.getElementById('stopSecondPartBtn');
const adminPartyStatus = document.getElementById('adminPartyStatus');
const partyStatus = document.getElementById('partyStatus');

let nickname = "";
let gender = "";
let floor = "";
let tableNumber = null;
let myGroupKey = null;
let isStaff = false;
let participantDocId = null;
let lastCupidCount = 0;
let adminFloor = "";
let secondParty = true;
let realName = "";
let isSecondPartActive = false;
let activeLikeStatusTab = 'final';
let timerAlertShown = false;
let _timerEndTime = 0;
let _timerIsActive = false;
let _timerUnsub = null;
let _adminTimerEndTime = 0;
let _adminTimerIsActive = false;
let _adminTimerUnsub = null;
let lastSosCount = -1;
let lastSongCount = -1;
let adminFirstLoad = true;

const conversationTopics = [
  "오늘 오기 전에 뭐하다 왔어요?",
  "혹시 집이 이 근처예요?",
  "저는 __좋아하는데, 혹시 취향 있어요?",
  "왜 오늘 소개팅 참여하게 된 거예요?",
  "이거 첫 참가예요? 어때요, 분위기 괜찮나요?",
  "요즘 빠져있는 취미 있어요?",
  "집에서 쉬는 스타일? 밖에 나가는 스타일?",
  "카페 vs 술집 vs 액티비티, 어디가 더 좋아요?",
  "최애 음식 뭐예요? 저는 __파인데!",
  "최근에 본 영화나 드라마 추천 있어요?",
  "주말에 보통 뭐하면서 지내요?",
  "친한 친구들이 말하는 나의 이미지?",
  "여행 스타일이 어떤 편이에요? 즉흥형 vs 계획형?",
  "고양이파예요? 강아지파예요?",
  "아 맞다, 혹시 MBTI 뭐예요?",
  "저는 __좋아하는데 혹시 비슷한 취향 있어요?",
  "혹시 이 근처 맛집 추천 좀 해주세요!",
  "여행 가본 곳 중에 제일 좋았던 곳 있어요?"
];

// 페이지 로드 시 저장된 세션 복구
async function restoreSession() {
  const savedNickname = localStorage.getItem('sumit_nickname');
  const savedGender = localStorage.getItem('sumit_gender');
  const savedFloor = localStorage.getItem('sumit_floor');
  const savedDocId = localStorage.getItem('sumit_docId');
  const savedSecondParty = localStorage.getItem('sumit_secondParty');
  
  if(savedNickname && savedGender && savedFloor && savedDocId) {
    try {
      // Firebase 문서 존재 확인
      const docSnap = await getDoc(doc(db, 'participants', savedDocId));
      if(docSnap.exists()) {
        const fbData = docSnap.data();
        nickname = savedNickname;
        gender = savedGender;
        floor = savedFloor;
        participantDocId = savedDocId;
        tableNumber = fbData.tableNumber || parseInt(localStorage.getItem('sumit_tableNumber')) || null;
        myGroupKey = fbData.groupKey || localStorage.getItem('sumit_groupKey') || (tableNumber ? String(tableNumber) : null);
        isStaff = fbData.isStaff || localStorage.getItem('sumit_isStaff') === 'true' || false;
        secondParty = fbData.secondParty ?? true;
        if(secondPartyCheckbox) secondPartyCheckbox.checked = secondParty;
        localStorage.setItem('sumit_secondParty', secondParty);
        realName = fbData.realName || localStorage.getItem('sumit_realName') || "";
        localStorage.setItem('sumit_realName', realName);
        if(fbData.age) localStorage.setItem('sumit_age', fbData.age);
        hide(entry);
        show(main);
        window.sumitRouter?.enterParticipant();
        setMyInfo();
        initChangeTableSelect();
        listenOppositeList();
        listenAnnouncements();
        listenCupidArrows();
        listenSecondPartStatus();
        listenMyStats();
        listenVote3rd();
      } else {
        // 문서가 없으면 닉네임+층으로 다시 찾기
        const q = query(collection(db, 'participants'), where('nickname','==',savedNickname), where('floor','==',savedFloor));
        const snapshot = await getDocs(q);
        if(!snapshot.empty) {
          const fbData2 = snapshot.docs[0].data();
          participantDocId = snapshot.docs[0].id;
          localStorage.setItem('sumit_docId', participantDocId);
          nickname = savedNickname;
          gender = savedGender;
          floor = savedFloor;
          tableNumber = fbData2.tableNumber || parseInt(localStorage.getItem('sumit_tableNumber')) || null;
          myGroupKey = fbData2.groupKey || localStorage.getItem('sumit_groupKey') || (tableNumber ? String(tableNumber) : null);
          isStaff = fbData2.isStaff || localStorage.getItem('sumit_isStaff') === 'true' || false;
          secondParty = fbData2.secondParty ?? true;
          if(secondPartyCheckbox) secondPartyCheckbox.checked = secondParty;
          localStorage.setItem('sumit_secondParty', secondParty);
          realName = fbData2.realName || localStorage.getItem('sumit_realName') || "";
          localStorage.setItem('sumit_realName', realName);
          if(fbData2.age) localStorage.setItem('sumit_age', fbData2.age);
          hide(entry);
          show(main);
          window.sumitRouter?.enterParticipant();
          setMyInfo();
          initChangeTableSelect();
          listenOppositeList();
          listenAnnouncements();
          listenCupidArrows();
          listenSecondPartStatus();
          listenMyStats();
          listenVote3rd();
        } else {
          // 참가자 정보가 완전히 삭제됨 - 로컬스토리지 클리어
          localStorage.removeItem('sumit_nickname');
          localStorage.removeItem('sumit_gender');
          localStorage.removeItem('sumit_floor');
          localStorage.removeItem('sumit_docId');
        }
      }
    } catch(err) {
      console.error('Session restore error:', err);
      // 오류 시 localStorage 클리어 후 입장 폼 표시
      localStorage.removeItem('sumit_nickname');
      localStorage.removeItem('sumit_gender');
      localStorage.removeItem('sumit_floor');
      localStorage.removeItem('sumit_docId');
      show(entry);
      hide(main);
      window.sumitRouter?.leaveParticipant();
    }
  }
}

// 페이지 로드 시 세션 복구
restoreSession();

function show(el) { if(el) el.classList.remove('hidden'); }
function hide(el) { if(el) el.classList.add('hidden'); }

function setMyInfo() { 
  greeting.textContent = `안녕하세요, ${nickname}님 👋`;
  farewell.textContent = `즐거운 파티 시간 보내세요! 🎉`;
  updateHomeSummary();
  listenTableRotation();
  listenTableMap();
  listenSignalVote();
  listenImageGame();
  listenBalanceGame();
  listenParty2();
  listenTimer();

  // 모바일 백그라운드 복귀 시 게임 상태 재조회 (한 번만 등록)
  if(!window._gameVisibilityRegistered) {
    window._gameVisibilityRegistered = true;
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') {
        // 화면 복귀 시 getDoc으로 최신 상태 즉시 읽기
        getDoc(doc(db, 'settings', IMAGE_GAME_DOC)).then(applyImageGameSnap).catch(() => {});
        getDoc(doc(db, 'settings', BALANCE_GAME_DOC)).then(applyBalanceGameSnap).catch(() => {});
      }
    });
  }
}

function updateHomeSummary() {
  const homeTableDisplay = document.getElementById('homeTableDisplay');
  if(homeTableDisplay) {
    if(isStaff) homeTableDisplay.textContent = '스탭';
    else homeTableDisplay.textContent = tableNumber ? `${tableNumber}번 테이블` : '테이블 확인 중';
  }
}

function listenParty2() {
  const party2Ref = doc(db, 'settings', 'party2');
  onSnapshot(party2Ref, snap => {
    const started = snap.exists() && snap.data().started === true;
    updateSecondPartFeatureVisibility(started);
  });
}

function updateSecondPartFeatureVisibility(active) {
  isSecondPartActive = active;
  [storySection, finalCard, vote3rdSection].forEach(section => {
    if(active) show(section);
    else hide(section);
  });

  const finalTab = document.querySelector('[data-like-tab="final"]');
  if(finalTab) {
    finalTab.style.display = active ? '' : 'none';
    if(!active && activeLikeStatusTab === 'final') {
      activeLikeStatusTab = 'match';
    }
  }
  renderLikeStatusDashboard();
  renderNotesList();
  updateTableMaps();
}

// 2차 참석 선택 UI 없음 — 모든 참가자 기본값 true (2차O)

let entering = false;
enterBtn.addEventListener('click', async () => {
  if(entering) return;
  nickname = nickInput.value.trim();
  realName = realNameInput ? realNameInput.value.trim() : "";
  const age = ageInput ? ageInput.value.trim() : "";
  const phoneNumber = phoneNumberInput ? phoneNumberInput.value.trim() : "";
  gender = genderSelect.value;
  floor = floorSelect ? floorSelect.value : 'floor2';
  secondParty = true;
  const tableVal = tableNumberSelect ? tableNumberSelect.value : '';
  isStaff = tableVal === 'staff';
  tableNumber = isStaff ? null : (parseInt(tableVal) || null);
  if(!nickname || !gender) { alert('닉네임과 성별을 입력해 주세요'); return; }
  if(!tableNumber && !isStaff) { alert('테이블 번호를 선택해 주세요'); return; }

  // PIN 검증 (스탭 제외)
  if(!isStaff) {
    const enteredPin = entryPinInput ? entryPinInput.value.trim() : '';
    if(!enteredPin) { alert('입장 PIN 번호를 입력해 주세요'); return; }
    try {
      const pinSnap = await getDoc(doc(db, 'settings', DAILY_PIN_DOC));
      const today = getTodayStr();
      if(!pinSnap.exists() || pinSnap.data().date !== today) {
        alert('오늘의 PIN 번호가 아직 설정되지 않았습니다. 스탭에게 문의해 주세요.'); return;
      }
      if(pinSnap.data().pin !== enteredPin) {
        alert('PIN 번호가 올바르지 않습니다. 스탭에게 문의해 주세요.'); return;
      }
    } catch(e) {
      alert('PIN 확인 중 오류가 발생했습니다. 다시 시도해 주세요.'); return;
    }
  }

  entering = true;
  enterBtn.disabled = true;
  enterBtn.textContent = '입장 중...';

  try {
    await cleanupDuplicateParticipantsForFloor(floor);

    // 닉네임 + 층으로 중복 체크
    const q = query(collection(db, 'participants'), where('nickname','==',nickname), where('floor','==',floor));
    const snapshot = await getDocs(q);
    
    if(!snapshot.empty) {
      const matchingDocs = snapshot.docs
        .filter(d => {
          const data = d.data();
          return data.gender === gender && (data.realName || '') === (realName || '') && (data.phoneNumber || '') === (phoneNumber || '');
        })
        .sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          return (bData.updated || bData.joined || 0) - (aData.updated || aData.joined || 0);
        });
      const existingDoc = matchingDocs[0] || snapshot.docs[0];
      const existingData = existingDoc.data();
      
      if(existingData.gender === gender && (existingData.realName || '') === (realName || '') && (existingData.phoneNumber || '') === (phoneNumber || '')) {
        participantDocId = existingDoc.id;
        // groupKey는 최초 등록 때 정해진 값을 유지 → 재입장해도 그룹 불변
        myGroupKey = existingData.groupKey || (tableNumber ? String(tableNumber) : null);
        const updateData = {
          updated: Date.now(),
          floor: floor,
          tableNumber: tableNumber,
          groupKey: myGroupKey,  // 기존 groupKey 그대로 저장
          isStaff: isStaff,
          secondParty: secondParty,
          realName: realName,
          age: age,
          phoneNumber: phoneNumber,
          currentTable: existingData.gender === 'male' ? (existingData.currentTable || tableNumber) : deleteField()
        };
        await updateDoc(doc(db, 'participants', participantDocId), updateData);
        if(matchingDocs.length > 1) {
          const batch = writeBatch(db);
          matchingDocs.slice(1).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } else {
        alert('이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.');
        entering = false;
        enterBtn.disabled = false;
        enterBtn.textContent = '입장하기 🎉';
        return;
      }
    } else {
      // 새로운 참가자 등록
      // groupKey = 자기 테이블 번호 (늦게 합류한 남성도 자기 테이블 그룹으로 배정)
      const groupKey = tableNumber ? String(tableNumber) : null;
      myGroupKey = groupKey;

      // 늦게 합류한 남성: 같은 groupKey의 현재 위치로 동기화
      let initialCurrentTable = tableNumber;
      if(gender === 'male' && groupKey) {
        try {
          const groupSnap = await getDocs(query(
            collection(db, 'participants'),
            where('groupKey', '==', groupKey),
            where('gender', '==', 'male'),
            where('floor', '==', floor)
          ));
          groupSnap.forEach(d => {
            const ct = d.data().currentTable;
            if(ct) initialCurrentTable = ct;
          });
        } catch(e) { /* fallback to tableNumber */ }
      }

      const joinedTs = Date.now();
      const docRef = await addDoc(collection(db, 'participants'), {nickname, gender, floor, tableNumber, currentTable: gender === 'male' ? initialCurrentTable : null, groupKey, isStaff, secondParty, realName, age, phoneNumber, cupidCount:2, finalCompleted:false, joined:joinedTs, updated: joinedTs});
      participantDocId = docRef.id;

      // 레이스 컨디션 방어: 동시 입장으로 동일 닉네임 문서가 2개 생성됐을 경우 오래된 것 삭제
      try {
        const dupQ = query(collection(db, 'participants'), where('nickname','==',nickname), where('floor','==',floor));
        const dupSnap = await getDocs(dupQ);
        if(dupSnap.size > 1) {
          const sorted = dupSnap.docs.slice().sort((a,b) => (b.data().updated||b.data().joined||0) - (a.data().updated||a.data().joined||0));
          for(let i = 1; i < sorted.length; i++) {
            if(sorted[i].id !== participantDocId) await deleteDoc(sorted[i].ref);
          }
        }
      } catch(e) { /* 정리 실패해도 입장은 계속 */ }
    }
    localStorage.setItem('sumit_nickname', nickname);
    localStorage.setItem('sumit_gender', gender);
    localStorage.setItem('sumit_floor', floor);
    localStorage.setItem('sumit_tableNumber', tableNumber || '');
    localStorage.setItem('sumit_groupKey', myGroupKey || '');
    localStorage.setItem('sumit_isStaff', isStaff ? 'true' : '');
    localStorage.setItem('sumit_docId', participantDocId);
    localStorage.setItem('sumit_secondParty', secondParty);
    localStorage.setItem('sumit_realName', realName);
    localStorage.setItem('sumit_age', age);
    hide(entry);
    show(main);
    window.sumitRouter?.enterParticipant();
    setMyInfo();
    initChangeTableSelect();
    listenOppositeList();
    listenAnnouncements();
    listenCupidArrows();
    listenSecondPartStatus();
    listenMyStats();
    listenVote3rd();
  } catch(err) {
    console.error('Enter error:', err);
    alert('입장 중 오류: ' + err.message);
    entering = false;
    enterBtn.disabled = false;
    enterBtn.textContent = '입장하기 🎉';
  }
});

// 나의 현황 (호감도) 실시간 업데이트
function listenMyStats() {
  if(!participantDocId || !floor) return;
  
  const myPopularityEl = document.getElementById('myPopularity');
  
  // 받은 호감도 실시간 감지
  const popularityQ = query(collection(db, 'popularity'), where('toId','==',participantDocId));
  onSnapshot(popularityQ, snap => {
    if(myPopularityEl) myPopularityEl.textContent = snap.size;
    myReceivedPopularity = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      myReceivedPopularity.push({
        fromId: data.fromId,
        fromName: data.fromName
      });
    });
    updateMyStatusCards();
    renderLikeStatusDashboard();
  });

  const sentPopularityQ = query(collection(db, 'popularity'), where('fromId','==',participantDocId));
  onSnapshot(sentPopularityQ, snap => {
    sentPopularityIds = new Set();
    mySentPopularity = [];
    snap.forEach(docSnap => {
      const sent = docSnap.data();
      if(sent.toId) sentPopularityIds.add(sent.toId);
      mySentPopularity.push({
        toId: sent.toId,
        toName: sent.toName
      });
    });
    popularityRemaining = Math.max(0, 3 - snap.size);
    const homePopularityLeft = document.getElementById('homePopularityLeft');
    if(homePopularityLeft) {
      homePopularityLeft.textContent = `${popularityRemaining}개 남음`;
    }
    updateMyStatusCards();
    renderLikeStatusDashboard();
    renderNotesList();
  });

  const finalQ = query(collection(db, 'final'), where('fromId','==',participantDocId));
  onSnapshot(finalQ, snap => {
    myFinalSelections = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      myFinalSelections.push({
        toId: data.toId,
        toName: data.toName
      });
    });
    renderLikeStatusDashboard();
  });
  
  // 2부 참여 여부 + currentTable 실시간 감지
  const mySecondPartyEl = document.getElementById('mySecondPartyStatus');
  onSnapshot(doc(db, 'participants', participantDocId), (docSnap) => {
    if(!docSnap.exists()) return;
    const data = docSnap.data();

    // tableNumber 변경 반영 (테이블 번호 변경 기능 지원)
    if(data.tableNumber && Number(data.tableNumber) !== tableNumber) {
      tableNumber = Number(data.tableNumber);
      localStorage.setItem('sumit_tableNumber', tableNumber);
      if(changeTableSelect) changeTableSelect.value = tableNumber;
    }
    if(currentTableDisplay) currentTableDisplay.textContent = tableNumber || '-';
    updateHomeSummary();

    // currentTable: 로테이션 시 관리자가 각 남자 participant 문서에 직접 저장
    // 여자는 항상 tableNumber 고정
    const prevCurrentTable = myCurrentTable;
    if(gender === 'male') {
      myCurrentTable = data.currentTable !== undefined ? data.currentTable : tableNumber;
    } else {
      myCurrentTable = tableNumber;
    }
    // 내 테이블이 바뀌면 참가자 목록 즉시 갱신 + 자리배치 카드 갱신
    if(prevCurrentTable !== myCurrentTable) {
      renderNotesList();
      if(typeof window._refreshRotationCard === 'function') window._refreshRotationCard();
    }

    if(!mySecondPartyEl) return;
    if(data.secondParty) {
      mySecondPartyEl.innerHTML = '<span style="background:#10b981; color:#fff; padding:4px 12px; border-radius:6px; font-size:13px;">🎊 2부 참석</span>';
    } else {
      mySecondPartyEl.innerHTML = '<span style="background:#666; color:#ccc; padding:4px 12px; border-radius:6px; font-size:13px;">2부 미참석</span>';
    }
    secondParty = data.secondParty || false;
  });
  
  // 호감도 명예의전당 실시간 업데이트
  listenPopularityRanking();
}

// ─────────────────────────────────────────────────────────────
// 3부 참여 투표
// ─────────────────────────────────────────────────────────────
const _v3state = { yesCount:0, femaleYes:0, maleYes:0, seedFemale:0, seedMale:0, myVote:null };

function updateVote3rdUI() {
  const { yesCount, femaleYes, maleYes, seedFemale, seedMale, myVote } = _v3state;
  const total       = yesCount + seedFemale + seedMale;
  const femaleTotal = femaleYes + seedFemale;
  const maleTotal   = maleYes  + seedMale;

  const phaseMsgEl = document.getElementById('vote3rdPhaseMsg');
  const barEl      = document.getElementById('vote3rdBar');
  const labelEl    = document.getElementById('vote3rdProgressLabel');
  const statusEl   = document.getElementById('vote3rdMyStatus');
  const yesBtnEl   = document.getElementById('vote3rdYes');

  // 참여 현황 메시지
  if(phaseMsgEl) {
    if(total >= 12) {
      phaseMsgEl.innerHTML = `<span style="font-size:17px;font-weight:900;color:#ff8fbd;">🎉 3부 확정!</span><br><span style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);">여성 ${femaleTotal}명 · 남성 ${maleTotal}명</span>`;
    } else {
      phaseMsgEl.innerHTML = `<span style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.75);">현재 <span style="color:#ff8fbd;font-size:20px;font-weight:900;">${total}</span>명 참여 확정 — 12명 모이면 3부 진행!</span>`;
    }
  }

  // 진행 게이지
  const pct = Math.min(total / 12 * 100, 100);
  if(barEl)    barEl.style.width        = pct + '%';
  if(labelEl)  labelEl.textContent      = total >= 12 ? `🔥 현재 ${total}명 참여중` : `${total} / 12`;

  // localStorage 또는 Firestore 기준으로 참여 여부 판단
  const lsKey    = `sumit_vote3rd_${floor}`;
  const hasVoted = myVote === 'yes' || localStorage.getItem(lsKey) === 'yes';

  if(yesBtnEl) {
    if(hasVoted) {
      yesBtnEl.innerHTML    = '✅ 참여 완료';
      yesBtnEl.style.background  = 'linear-gradient(135deg,rgba(255,60,135,0.55),rgba(255,60,135,0.35))';
      yesBtnEl.style.borderColor = '#ff3c87';
      yesBtnEl.style.color       = '#fff';
      yesBtnEl.style.boxShadow   = '0 0 20px rgba(255,60,135,0.35)';
      yesBtnEl.disabled = true;
      yesBtnEl.style.cursor = 'default';
    } else {
      yesBtnEl.innerHTML    = '참여할게요 ✅';
      yesBtnEl.style.background  = 'rgba(255,60,135,0.12)';
      yesBtnEl.style.borderColor = 'rgba(255,60,135,0.4)';
      yesBtnEl.style.color       = '#ff8fbd';
      yesBtnEl.style.boxShadow   = 'none';
      yesBtnEl.disabled = false;
      yesBtnEl.style.cursor = 'pointer';
    }
  }

  if(statusEl) statusEl.textContent = hasVoted ? '🔥 3부 참여 의사 등록 완료!' : '';
}

function listenVote3rd() {
  if(!floor) return;

  // 투표 리스너
  const q = query(collection(db, 'votes3rd'), where('floor','==',floor));
  onSnapshot(q, snap => {
    let yesCount = 0, femaleYes = 0, maleYes = 0, myVote = null;
    snap.forEach(d => {
      const v = d.data();
      if(v.vote === 'yes') {
        yesCount++;
        if(v.gender === 'female') femaleYes++;
        else if(v.gender === 'male') maleYes++;
      }
      if(participantDocId && d.id === participantDocId) myVote = v.vote;
    });
    Object.assign(_v3state, { yesCount, femaleYes, maleYes, myVote });
    updateVote3rdUI();
  });

  // 시딩 리스너
  const seedRef = doc(db, 'settings', `vote3rdSeed_${floor}`);
  onSnapshot(seedRef, snap => {
    const data = snap.exists() ? snap.data() : {};
    _v3state.seedFemale = data.female || 0;
    _v3state.seedMale   = data.male   || 0;
    updateVote3rdUI();
  });

  // 버튼 핸들러
  const vote3rdYesBtn = document.getElementById('vote3rdYes');
  async function submitVote() {
    if(!participantDocId) return;
    const lsKey = `sumit_vote3rd_${floor}`;
    if(localStorage.getItem(lsKey) === 'yes') return;
    await setDoc(doc(db, 'votes3rd', participantDocId), {
      floor, vote: 'yes', nickname, gender,
      timestamp: new Date()
    });
    localStorage.setItem(lsKey, 'yes');
  }
  if(vote3rdYesBtn) vote3rdYesBtn.addEventListener('click', submitVote);
}

// 호감도 명예의전당 - 남녀 1,2등 실시간 표시
function listenPopularityRanking() {
  if(!floor) return;
  
  const maleRank1El = document.getElementById('maleRank1');
  const maleRank2El = document.getElementById('maleRank2');
  const femaleRank1El = document.getElementById('femaleRank1');
  const femaleRank2El = document.getElementById('femaleRank2');
  
  // 같은 층 호감도 데이터 실시간 감지
  const popQ = query(collection(db, 'popularity'), where('floor','==',floor));
  onSnapshot(popQ, async (popSnap) => {
    // 호감도 집계
    const popularityCounts = {};
    popSnap.forEach(d => {
      const toId = d.data().toId;
      popularityCounts[toId] = (popularityCounts[toId] || 0) + 1;
    });
    
    // 참가자 정보 가져오기
    const participantsSnap = await getDocs(query(collection(db, 'participants'), where('floor','==',floor)));
    const males = [];
    const females = [];
    
    participantsSnap.forEach(p => {
      const data = p.data();
      const count = popularityCounts[p.id] || 0;
      if(count > 0) {
        if(data.gender === 'male') {
          males.push({nickname: data.nickname, count});
        } else if(data.gender === 'female') {
          females.push({nickname: data.nickname, count});
        }
      }
    });
    
    // 호감도 순으로 정렬
    males.sort((a, b) => b.count - a.count);
    females.sort((a, b) => b.count - a.count);
    
    // 순위 표시 (닉네임만)
    if(maleRank1El) maleRank1El.textContent = males[0] ? males[0].nickname : '-';
    if(maleRank2El) maleRank2El.textContent = males[1] ? males[1].nickname : '-';
    if(femaleRank1El) femaleRank1El.textContent = females[0] ? females[0].nickname : '-';
    if(femaleRank2El) femaleRank2El.textContent = females[1] ? females[1].nickname : '-';
  });
}

let finalSelected = [];

let noteSelected = [];
let allOppositeParticipants = []; // 전체 이성 참가자
let allVisibleParticipants = []; // 참가자 탭 전체 참가자
let myCurrentTable = null; // 내 현재 테이블 (로테이션 배정용)
let sentPopularityIds = new Set();
let popularityRemaining = 3;
let myReceivedPopularity = [];
let mySentPopularity = [];
let myFinalSelections = [];

function updateMyStatusCards() {
  const receivedCard = document.getElementById('homeReceivedLikesCard');
  const matchCard = document.getElementById('homeMatchCard');
  const receivedDetail = document.getElementById('homeReceivedLikeDetail');
  const receivedSummary = document.getElementById('homeReceivedLikeSummary');
  const matchDetail = document.getElementById('homeMatchDetail');
  const matchSummary = document.getElementById('homeMatchSummary');
  if(!receivedDetail || !receivedSummary || !matchDetail || !matchSummary) return;

  const mutualLikes = myReceivedPopularity.filter(item => item.fromId && sentPopularityIds.has(item.fromId));
  if(receivedCard) receivedCard.classList.toggle('unlocked', isSecondPartActive);
  if(matchCard) matchCard.classList.toggle('unlocked', isSecondPartActive);

  receivedSummary.textContent = `${myReceivedPopularity.length}개 받음`;
  matchSummary.textContent = `${mutualLikes.length}개 매칭`;

  if(isSecondPartActive) {
    receivedSummary.textContent = String(myReceivedPopularity.length);
    receivedDetail.textContent = myReceivedPopularity.length ? '호감을 받았어요' : '아직 받은 호감이 없어요';
    matchSummary.textContent = mutualLikes.length ? `${mutualLikes.length}명 매칭` : '결과 대기중';
    matchDetail.textContent = mutualLikes.length
      ? '서로 호감이 통했어요'
      : '호감 공개 후 확인';
  } else {
    receivedSummary.textContent = `${myReceivedPopularity.length}개 받음`;
    matchSummary.textContent = '결과 대기중';
    receivedDetail.textContent = '호감을 누구한테 받았는지는 2부에서 공개돼요';
    matchDetail.textContent = '호감 공개 후 확인';
  }
}

function getParticipantProfile(targetId) {
  const found = [...allVisibleParticipants, ...allOppositeParticipants].find(item => item.id === targetId);
  return found ? found.data : null;
}

function getProfileName(item) {
  const participant = getParticipantProfile(item.id || item.fromId || item.toId);
  return participant?.nickname || item.name || item.fromName || item.toName || '익명';
}

function profileDetailText(item) {
  const participant = getParticipantProfile(item.id || item.fromId || item.toId);
  if(!isSecondPartActive) return '이름/나이는 2부부터 공개돼요';
  const real = participant?.realName || item.realName || '이름 미입력';
  const age = participant?.age || item.age || '나이 미입력';
  return `${real} · ${age}`;
}

function showProfileDetail(targetId) {
  const participant = getParticipantProfile(targetId);
  if(!isSecondPartActive) {
    alert('프로필은 2부가 시작되면 확인할 수 있어요.');
    return;
  }
  const nick = participant?.nickname || '익명';
  const real = participant?.realName || '이름 미입력';
  const age = participant?.age || '나이 미입력';
  alert(`프로필 보기\n\n닉네임: ${nick}\n이름: ${real}\n나이: ${age}`);
}

function renderLikeStatusDashboard(nextTab) {
  if(nextTab) activeLikeStatusTab = nextTab;
  const tabs = document.getElementById('likeStatusTabs');
  const content = document.getElementById('likeResultContent');
  if(!tabs || !content) return;

  const mutualLikes = myReceivedPopularity
    .filter(item => item.fromId && sentPopularityIds.has(item.fromId))
    .map(item => ({ id: item.fromId, name: item.fromName }));
  const groups = {
    final: myFinalSelections.map(item => ({ id: item.toId, name: item.toName })),
    match: mutualLikes,
    received: myReceivedPopularity.map(item => ({ id: item.fromId, name: item.fromName })),
    sent: mySentPopularity.map(item => ({ id: item.toId, name: item.toName }))
  };
  const meta = {
    final: { title: '최종 선택', empty: '최종 선택하면 여기에 표시돼요.' },
    match: { title: '♡ 매칭', empty: '서로 호감을 보내면 매칭으로 표시돼요.' },
    received: { title: '받은 호감', empty: '아직 받은 호감이 없어요.' },
    sent: { title: '보낸 호감', empty: '아직 보낸 호감이 없어요.' }
  };

  [
    ['likeFinalCount', groups.final.length],
    ['likeMatchCount', groups.match.length],
    ['likeReceivedCount', groups.received.length],
    ['likeSentCount', groups.sent.length]
  ].forEach(([id, count]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = `(${count})`;
  });

  tabs.querySelectorAll('[data-like-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.likeTab === activeLikeStatusTab);
  });

  const list = groups[activeLikeStatusTab] || groups.final;
  const currentMeta = meta[activeLikeStatusTab] || meta.final;
  if(!isSecondPartActive && activeLikeStatusTab !== 'sent') {
    content.innerHTML = '<strong>결과 대기중</strong><p>호감 공개 후 확인할 수 있어요.</p>';
    return;
  }

  if(list.length === 0) {
    content.innerHTML = `<strong>${escapeHtml(currentMeta.title)}</strong><p>${escapeHtml(currentMeta.empty)}</p>`;
    return;
  }

  content.innerHTML = `
    <strong>${escapeHtml(currentMeta.title)}</strong>
    <div class="like-result-list">
      ${list.map(item => `
        <div class="like-result-person">
          <div>
            <b>${escapeHtml(getProfileName(item))}</b>
            <span>${escapeHtml(profileDetailText(item))}</span>
          </div>
          <button type="button" data-profile-id="${escapeHtml(item.id || '')}">프로필 보기</button>
        </div>
      `).join('')}
    </div>
  `;
  content.querySelectorAll('[data-profile-id]').forEach(button => {
    button.addEventListener('click', () => showProfileDetail(button.dataset.profileId));
  });
}

window.renderLikeStatusDashboard = renderLikeStatusDashboard;

function renderNotesList(filterText) {
  const searchInput = document.getElementById('noteSearchInput');
  const participantTotalCount = document.getElementById('participantTotalCount');
  const participantCountSummary = document.getElementById('participantCountSummary');
  const participantLikeLeft = document.getElementById('participantLikeLeft');
  if(!oppositeList) return;
  if(filterText === undefined) filterText = searchInput ? searchInput.value : '';
  oppositeList.innerHTML = '';
  if(participantTotalCount) participantTotalCount.textContent = `(${allVisibleParticipants.length}명)`;
  if(participantLikeLeft) participantLikeLeft.textContent = `${popularityRemaining}/3 남음`;

  if(allVisibleParticipants.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'participant-empty';
    empty.textContent = '참가자가 없습니다';
    oppositeList.appendChild(empty);
    if(participantCountSummary) participantCountSummary.textContent = '0명 / 총 0명';
    return;
  }

  const query = filterText.trim().toLowerCase();
  const filtered = query
    ? allVisibleParticipants.filter(({ data }) => data.nickname && data.nickname.toLowerCase().includes(query))
    : allVisibleParticipants;

  if(filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'participant-empty';
    empty.textContent = `"${filterText}" 검색 결과가 없습니다`;
    oppositeList.appendChild(empty);
    if(participantCountSummary) participantCountSummary.textContent = `0명 / 총 ${allVisibleParticipants.length}명`;
    return;
  }
  if(participantCountSummary) participantCountSummary.textContent = `1-${filtered.length}명 / 총 ${allVisibleParticipants.length}명`;

  filtered.forEach(({ id: docId, data }) => {
    const card = document.createElement('div');
    card.className = 'participant-row-card';

    const avatar = document.createElement('div');
    avatar.className = 'participant-avatar';
    avatar.textContent = (data.nickname || '?').slice(0, 1);

    const info = document.createElement('div');
    info.className = 'participant-info';
    const displayName = getParticipantDisplayName(data);
    const currentTable = data.currentTable || data.tableNumber || '-';
    const privateText = isSecondPartActive
      ? `👤 ${data.realName || '이름 미입력'} · ${data.age ? `${data.age}세` : '나이 미입력'}`
      : '🔒 나이/이름은 2부부터 공개';
    info.innerHTML = `
      <strong>${escapeHtml(displayName || '익명')}</strong>
      <span class="participant-table">📍 현재 ${escapeHtml(currentTable)}번 테이블</span>
      <span class="participant-private">${escapeHtml(privateText)}</span>
    `;

    const likeButton = document.createElement('button');
    likeButton.type = 'button';
    likeButton.className = 'participant-like-btn';
    const alreadySent = sentPopularityIds.has(docId);
    const isMe = docId === participantDocId;
    const isSameGender = data.gender === gender;
    const isDisabledTarget = isMe || isSameGender;
    const buttonLabel = isMe ? '나' : (isSameGender ? '동성' : (alreadySent ? '완료' : '호감'));
    likeButton.innerHTML = `<span>♡</span><strong>${buttonLabel}</strong>`;
    likeButton.disabled = isDisabledTarget || alreadySent || popularityRemaining <= 0;
    if(alreadySent) likeButton.classList.add('sent');
    likeButton.addEventListener('click', async () => {
      likeButton.disabled = true;
      const ok = await sendPopularityTo(docId);
      if(!ok && !sentPopularityIds.has(docId)) likeButton.disabled = false;
    });

    card.appendChild(avatar);
    card.appendChild(info);
    card.appendChild(likeButton);
    oppositeList.appendChild(card);
  });
}

// 검색창 이벤트 연결 (DOM 준비 후)
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('noteSearchInput');
  if(searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderNotesList(e.target.value);
    });
  }
});

function listenOppositeList() {
  const target = (gender === 'male') ? 'female' : 'male';
  const q = query(collection(db, 'participants'), where('gender','==',target), where('floor','==',floor));
  const allQ = query(collection(db, 'participants'), where('gender','==',target), where('floor','==',floor));

  onSnapshot(allQ, snapshot => {
    allVisibleParticipants = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      if(d.isStaff) return;
      allVisibleParticipants.push({ id: docSnap.id, data: d });
    });
    allVisibleParticipants.sort((a, b) => {
      const tableA = Number(a.data.currentTable || a.data.tableNumber || 999);
      const tableB = Number(b.data.currentTable || b.data.tableNumber || 999);
      if(tableA !== tableB) return tableA - tableB;
      return (a.data.nickname || '').localeCompare(b.data.nickname || '', 'ko');
    });
    renderNotesList();
    renderLikeStatusDashboard();
  });

  // 전체 이성 참가자 리스너 (최종선택/큐피드/호감도)
  onSnapshot(q, snapshot => {
    const prevFinalSelected = [...finalSelected];
    const currentIds = new Set();
    snapshot.forEach(docSnap => currentIds.add(docSnap.id));

    finalSelected = prevFinalSelected.filter(id => currentIds.has(id));

    finalListContainer.innerHTML = '';
    cupidList.innerHTML = '';
    popularityList.innerHTML = '';

    const finalCountEl = document.getElementById('finalCount');
    if(finalCountEl) finalCountEl.textContent = finalSelected.length;
    if(finalPickBtn) {
      finalPickBtn.disabled = finalSelected.length !== 2;
      finalPickBtn.style.opacity = finalSelected.length === 2 ? '1' : '0.5';
    }

    const genderLabel = (target === 'male') ? '남성' : '여성';

    allOppositeParticipants = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      if(d.isStaff) return; // 스태프 제외
      allOppositeParticipants.push({ id: docSnap.id, data: d });
    });

    // 최종선택 / 큐피드 / 호감도 목록 (전체 이성)
    allOppositeParticipants.forEach(({ id: docId, data }) => {
      const cupidDisplayName = isSecondPartActive && data.realName ? `${data.nickname} (${data.realName})` : data.nickname;

      const opt3 = document.createElement('option');
      opt3.value = docId;
      opt3.textContent = `${cupidDisplayName} (${genderLabel})`;
      cupidList.appendChild(opt3);

      const opt4 = document.createElement('option');
      opt4.value = docId;
      opt4.textContent = `${cupidDisplayName} (${genderLabel})`;
      popularityList.appendChild(opt4);

      const btn = document.createElement('button');
      btn.dataset.id = docId;
      const finalDisplayName = isSecondPartActive && data.realName ? `${data.nickname} (${data.realName})` : data.nickname;
      btn.textContent = finalDisplayName;
      btn.style.cssText = 'padding:12px; border-radius:8px; border:2px solid rgba(255,255,255,0.3); background:transparent; color:#fff; cursor:pointer; font-size:14px; font-weight:500; transition:all 0.2s;';

      const applySelectedStyle = (b) => {
        b.style.backgroundColor = '#10b981';
        b.style.borderColor = '#10b981';
        b.style.color = '#fff';
        b.style.boxShadow = '0 0 16px rgba(16,185,129,0.7), inset 0 0 10px rgba(255,255,255,0.2)';
        b.style.transform = 'scale(1.05)';
        b.textContent = '✅ ' + b.getAttribute('data-nick');
        b.style.fontWeight = '800';
        b.style.fontSize = '15px';
      };
      const applyUnselectedStyle = (b) => {
        b.style.backgroundColor = 'transparent';
        b.style.borderColor = 'rgba(255,255,255,0.3)';
        b.style.color = '#fff';
        b.style.boxShadow = 'none';
        b.style.transform = 'scale(1)';
        b.textContent = b.getAttribute('data-nick');
        b.style.fontWeight = '500';
        b.style.fontSize = '14px';
      };
      btn.setAttribute('data-nick', btn.textContent);

      if(finalSelected.includes(docId)) applySelectedStyle(btn);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if(finalSelected.includes(docId)) {
          finalSelected = finalSelected.filter(id => id !== docId);
          applyUnselectedStyle(btn);
        } else {
          if(finalSelected.length < 2) {
            finalSelected.push(docId);
            applySelectedStyle(btn);
          } else {
            alert('2명까지만 선택할 수 있습니다');
          }
        }
        document.getElementById('finalCount').textContent = finalSelected.length;
        finalPickBtn.disabled = finalSelected.length !== 2;
        finalPickBtn.style.opacity = finalSelected.length === 2 ? '1' : '0.5';
      });
      finalListContainer.appendChild(btn);
    });

    // 참가자 목록은 테이블 필터 적용 (currentTable 기반 → 자동 갱신)
    renderNotesList();
    renderLikeStatusDashboard();
  });
}

let finalSubmitting = false; // 중복 제출 방지 플래그

finalPickBtn.addEventListener('click', async () => {
  if(finalSelected.length !== 2) { alert('2명을 선택해주세요'); return; }
  
  // 중복 클릭 방지
  if(finalSubmitting) {
    console.log('Final selection already in progress');
    return;
  }
  
  // 확인 팝업
  if(!confirm('⚠️ 최종선택 확인\n\n선택하신 2명에게 최종선택을 보냅니다.\n\n❌ 한 번 선택하면 절대 수정할 수 없습니다!\n\n신중하게 결정하셨나요?')) {
    return;
  }
  
  // 기본 유효성 검사
  if(!participantDocId) {
    alert('참가자 정보가 없습니다. 페이지를 새로고침해주세요.');
    return;
  }
  
  finalSubmitting = true;
  finalPickBtn.disabled = true;
  finalPickBtn.textContent = '전송 중...';
  
  try {
    const meDoc = await getDoc(doc(db, 'participants', participantDocId));
    if(!meDoc.exists()) {
      alert('참가자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      finalSubmitting = false;
      finalPickBtn.disabled = false;
      finalPickBtn.textContent = '최종 선택 전송';
      return;
    }
    
    const me = meDoc.data();
    if(me.finalCompleted) { 
      alert('이미 최종 선택을 완료했습니다'); 
      finalSubmitting = false;
      finalPickBtn.disabled = true;
      finalPickBtn.style.opacity = '0.5';
      finalPickBtn.textContent = '선택 완료됨';
      return; 
    }
    
    // 선택한 대상들 유효성 검사
    const selectedTargets = [...finalSelected];
    for(const targetId of selectedTargets) {
      const toDoc = await getDoc(doc(db, 'participants', targetId));
      if(!toDoc.exists()) {
        alert('선택한 참가자 중 일부가 존재하지 않습니다. 다시 선택해주세요.');
        finalSubmitting = false;
        finalPickBtn.disabled = false;
        finalPickBtn.textContent = '최종 선택 전송';
        return;
      }
      await addDoc(collection(db, 'final'), {
        fromId: participantDocId, 
        fromName: nickname, 
        toId: targetId, 
        toName: toDoc.data().nickname, 
        floor, 
        time: Date.now()
      });
    }
    
    await updateDoc(doc(db, 'participants', participantDocId), {finalCompleted: true});
    alert('최종 선택 완료! (다시 선택할 수 없습니다)');
    finalSelected = [];
    document.getElementById('finalCount').textContent = '0';
    finalPickBtn.disabled = true;
    finalPickBtn.style.opacity = '0.5';
    finalPickBtn.textContent = '선택 완료됨';
    Array.from(document.querySelectorAll('#finalListContainer button')).forEach(btn => {
      btn.style.backgroundColor = 'transparent';
      btn.style.borderColor = 'rgba(255,255,255,0.3)';
      btn.style.color = '#fff';
      btn.disabled = true;
    });
  } catch(err) {
    console.error('Final error:', err);
    alert('최종 선택 중 오류가 발생했습니다.\n\n오류 내용: ' + err.message + '\n\n페이지를 새로고침 후 다시 시도해주세요.');
    finalPickBtn.disabled = false;
    finalPickBtn.textContent = '최종 선택 전송';
  } finally {
    finalSubmitting = false;
  }
});

cupidBtn.addEventListener('click', async () => {
  const targetId = cupidList.value;
  if(!targetId) { alert('대상을 선택하세요'); return; }
  try {
    const meDoc = await getDoc(doc(db, 'participants', participantDocId));
    const me = meDoc.data();
    const remaining = me.cupidCount ?? 0;
    if(remaining <= 0) { alert('큐피드 사용 횟수를 모두 사용했습니다 (최대 2회)'); return; }
    const toDoc = await getDoc(doc(db, 'participants', targetId));
    await addDoc(collection(db, 'cupid'), {fromId:participantDocId, fromName:nickname, toId:targetId, toName:toDoc.data().nickname, floor, time:Date.now()});
    await updateDoc(doc(db, 'participants', participantDocId), {cupidCount: remaining - 1});
    alert(`큐피드 발사 완료! (남은 횟수: ${remaining - 1}회)`);
  } catch(err) {
    console.error('Cupid error:', err);
    alert('큐피드 사용 중 오류: ' + err.message);
  }
});

async function sendPopularityTo(targetId) {
  if(!targetId) { alert('대상을 선택하세요'); return false; }
  try {
    // 내가 보낸 호감도 총 횟수 확인 (3회 제한)
    const sentQ = query(collection(db, 'popularity'), where('fromId','==',participantDocId));
    const sentSnap = await getDocs(sentQ);
    if(sentSnap.size >= 3) {
      alert('호감도는 이성에게 총 3회만 사용가능합니다!');
      return false;
    }
    // 같은 사람에게 중복 방지
    const dupQ = query(collection(db, 'popularity'), where('fromId','==',participantDocId), where('toId','==',targetId));
    const dupSnap = await getDocs(dupQ);
    if(!dupSnap.empty) {
      alert('이미 이 분에게 호감도를 보냈습니다!');
      return false;
    }
    const toDoc = await getDoc(doc(db, 'participants', targetId));
    const remaining = 2 - sentSnap.size;
    await addDoc(collection(db, 'popularity'), {fromId:participantDocId, fromName:nickname, toId:targetId, toName:toDoc.data().nickname, floor, time:Date.now()});
    alert(`호감도를 보냈습니다! ⭐ (남은 횟수: ${remaining}회)`);
    return true;
  } catch(err) {
    console.error('Popularity error:', err);
    alert('호감도 주기 중 오류: ' + err.message);
    return false;
  }
}

popularityBtn.addEventListener('click', async () => {
  await sendPopularityTo(popularityList.value);
});

songBtn.addEventListener('click', async () => {
  const title = songTitle.value.trim();
  const artist = songArtist.value.trim();
  if(!title || !artist) { alert('제목과 가수를 입력하세요'); return; }
  try {
    await addDoc(collection(db, 'songs'), {title, artist, fromId:participantDocId, fromName:nickname, floor, time:Date.now()});
    songTitle.value = songArtist.value = '';
    alert('노래 요청 완료!');
  } catch(err) {
    console.error('Song error:', err);
    alert('노래 요청 중 오류: ' + err.message);
  }
});

sosBtn.addEventListener('click', async () => {
  const reason = sosReason.value.trim();
  if(!reason) { alert('사유를 입력해주세요'); return; }
  try {
    await addDoc(collection(db, 'sos'), {fromId:participantDocId, fromName:nickname, reason, floor, time:Date.now()});
    sosReason.value = '';
    alert('SOS 요청이 전송되었습니다');
  } catch(err) {
    console.error('SOS error:', err);
    alert('SOS 요청 중 오류: ' + err.message);
  }
});

sendStoryBtn.addEventListener('click', async () => {
  const story = storyContent.value.trim();
  if(!story) { alert('사연을 입력해주세요'); return; }
  try {
    await addDoc(collection(db, 'stories'), {fromId:participantDocId, fromName:nickname, story, floor, time:Date.now()});
    storyContent.value = '';
    alert('사연이 전송되었습니다 🎉');
  } catch(err) {
    console.error('Story error:', err);
    alert('사연 전송 중 오류: ' + err.message);
  }
});

function listenAnnouncements() {
  if(!announcements) return; // null 체크
  const q = query(collection(db, 'announcements'), orderBy('time','desc'), limit(5));
  onSnapshot(q, snap => {
    if(!announcements) return;
    announcements.innerHTML = '';
    if(snap.empty) { announcements.textContent = '공지 없음'; return; }
    snap.forEach(d => {
      const el = document.createElement('div');
      el.textContent = d.data().text;
      announcements.appendChild(el);
    });
  });
}


getConversationBtn.addEventListener('click', () => {
  const randomTopic = conversationTopics[Math.floor(Math.random() * conversationTopics.length)];
  conversationTopic.innerHTML = `
    <div style="font-size:11px; color:#ffa500; font-weight:600; margin-bottom:6px; letter-spacing:0.5px;">💬 이렇게 말해보세요</div>
    <div style="font-weight:700; color:#fff; font-size:15px; line-height:1.7;">"${randomTopic}"</div>
  `;
});

if(changeNickBtn) changeNickBtn.addEventListener('click', async () => {
  const newNick = newNickInput.value.trim();
  if(!newNick) { alert('새 닉네임을 입력해주세요'); return; }
  if(newNick === nickname) { alert('현재 닉네임과 동일합니다'); return; }
  if(!participantDocId) { alert('먼저 파티에 입장해주세요'); return; }
  
  try {
    // 중복 확인
    const q = query(collection(db, 'participants'), where('nickname','==',newNick));
    const snapshot = await getDocs(q);
    if(!snapshot.empty && snapshot.docs[0].id !== participantDocId) {
      alert('이미 사용중인 닉네임입니다');
      return;
    }
    
    // 문서 존재 확인
    const docRef = doc(db, 'participants', participantDocId);
    const docSnap = await getDoc(docRef);
    if(!docSnap.exists()) {
      alert('참가자 정보를 찾을 수 없습니다. 다시 입장해주세요.');
      return;
    }
    
    await updateDoc(docRef, {nickname: newNick});
    nickname = newNick;
    localStorage.setItem('sumit_nickname', newNick);
    setMyInfo();
    newNickInput.value = '';
    alert('닉네임이 변경되었습니다!');
  } catch(err) {
    console.error('Nickname change error:', err);
    alert('닉네임 변경 중 오류: ' + err.message);
  }
});

// 테이블 변경 드롭다운 초기화 (1~14번)
function initChangeTableSelect() {
  if(!changeTableSelect) return;
  changeTableSelect.innerHTML = '<option value="">테이블 선택</option>';
  for(let i = 1; i <= TOTAL_TABLES; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i}번 테이블`;
    changeTableSelect.appendChild(opt);
  }
  if(tableNumber) changeTableSelect.value = tableNumber;
  if(currentTableDisplay) currentTableDisplay.textContent = tableNumber || '-';
}

changeTableBtn && changeTableBtn.addEventListener('click', async () => {
  const newTableVal = parseInt(changeTableSelect.value);
  if(!newTableVal) { alert('변경할 테이블 번호를 선택해주세요'); return; }
  if(newTableVal === tableNumber) { alert('현재 테이블과 동일합니다'); return; }
  if(!participantDocId) { alert('먼저 파티에 입장해주세요'); return; }
  if(!confirm(`테이블을 ${newTableVal}번으로 변경하시겠습니까?\n참가자 목록에 보이는 이성도 즉시 변경됩니다.`)) return;

  try {
    const docRef = doc(db, 'participants', participantDocId);
    const docSnap = await getDoc(docRef);
    if(!docSnap.exists()) { alert('참가자 정보를 찾을 수 없습니다'); return; }

    // tableNumber만 업데이트 — groupKey는 최초 그룹 유지 (로테이션 그룹 불변)
    await updateDoc(docRef, {
      tableNumber: newTableVal,
      currentTable: deleteField()
    });

    tableNumber = newTableVal;
    myCurrentTable = newTableVal;
    localStorage.setItem('sumit_tableNumber', newTableVal);
    if(currentTableDisplay) currentTableDisplay.textContent = newTableVal;
    if(changeTableSelect) changeTableSelect.value = newTableVal;
    setMyInfo();
    renderNotesList();
    alert(`${newTableVal}번 테이블로 변경되었습니다!`);
  } catch(err) {
    console.error('Table change error:', err);
    alert('테이블 변경 중 오류: ' + err.message);
  }
});

leaveBtn.addEventListener('click', async () => {
  if(!confirm('파티에서 나가시겠습니까?\n참가자 목록에서 삭제됩니다.')) return;
  if(participantDocId) {
    try {
      await deleteDoc(doc(db, 'participants', participantDocId));
    } catch(err) {}
  }
  localStorage.removeItem('sumit_nickname');
  localStorage.removeItem('sumit_gender');
  localStorage.removeItem('sumit_floor');
  localStorage.removeItem('sumit_docId');
  localStorage.removeItem('sumit_secondParty');
  localStorage.removeItem('sumit_isStaff');
  localStorage.removeItem('sumit_groupKey');
  location.reload();
});

// ── 일일 PIN 관리 ──────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateRandomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function loadOrCreateDailyPin(forceNew = false) {
  const pinRef = doc(db, 'settings', DAILY_PIN_DOC);
  const snap = await getDoc(pinRef);
  const today = getTodayStr();

  let pin;
  if(!forceNew && snap.exists() && snap.data().date === today) {
    pin = snap.data().pin;
  } else {
    pin = generateRandomPin();
    await setDoc(pinRef, { pin, date: today });
  }

  if(adminDailyPinEl) adminDailyPinEl.textContent = pin;
  if(adminPinDateEl) adminPinDateEl.textContent = `📅 ${today} 기준`;
}

if(regenPinBtn) {
  regenPinBtn.addEventListener('click', async () => {
    if(!confirm('PIN 번호를 새로 발급하시겠습니까? 기존 PIN은 사용할 수 없습니다.')) return;
    await loadOrCreateDailyPin(true);
    alert('새 PIN 번호가 발급되었습니다.');
  });
}

const startParty2Btn = document.getElementById('startParty2Btn');
const endParty2Btn = document.getElementById('endParty2Btn');
if(startParty2Btn) {
  startParty2Btn.addEventListener('click', async () => {
    if(!confirm('2부 파티를 시작하시겠습니까?\n참가자 화면에 최종선택, 3차투표, 사연이벤트가 표시됩니다.')) return;
    const currentFloor = adminFloor || (adminFloorSelect ? adminFloorSelect.value : 'floor2') || 'floor2';
    await Promise.all([
      setDoc(doc(db, 'settings', 'party2'), { started: true }),
      setDoc(doc(db, 'settings', 'secondPart_' + currentFloor), { active: true, startedAt: new Date() })
    ]);
  });
}
if(endParty2Btn) {
  endParty2Btn.addEventListener('click', async () => {
    if(!confirm('2부 파티를 종료하시겠습니까?\n참가자 화면에서 해당 기능들이 숨겨집니다.')) return;
    const currentFloor = adminFloor || (adminFloorSelect ? adminFloorSelect.value : 'floor2') || 'floor2';
    await Promise.all([
      setDoc(doc(db, 'settings', 'party2'), { started: false }),
      setDoc(doc(db, 'settings', 'secondPart_' + currentFloor), { active: false })
    ]);
  });
}

function resetAdminPanel() {
  if(adminPanel && !adminPanel.classList.contains('hidden')) {
    hide(adminPanel);
    if(adminPw) adminPw.value = '';
  }
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  if(hash !== '/admin' && hash !== '/admin/') {
    resetAdminPanel();
  }
});

adminLoginBtn.addEventListener('click', async () => {
  const pw = adminPw.value;
  adminFloor = adminFloorSelect ? adminFloorSelect.value : 'floor2';
  if(!adminPasswordHash) { alert('관리자 비밀번호 설정이 없습니다'); return; }
  if(await sha256Hex(pw) !== adminPasswordHash) { alert('비밀번호가 틀렸습니다'); return; }
  show(adminPanel);
  initAdminTabs();
  loadAdminRealtime();
  await loadOrCreateDailyPin();
});

function initAdminTabs() {
  const panel = document.getElementById('adminPanel');
  if(!panel || panel.dataset.tabsReady === 'true') return;
  panel.dataset.tabsReady = 'true';
  const tabButtons = panel.querySelectorAll('[data-admin-tab]');
  const pages = panel.querySelectorAll('[data-admin-page]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.adminTab;
      tabButtons.forEach(item => item.classList.toggle('active', item === button));
      pages.forEach(page => page.classList.toggle('active', page.dataset.adminPage === target));
    });
  });
}

async function deleteDocsForFloor(collectionName, targetFloor) {
  const snap = await getDocs(query(collection(db, collectionName), where('floor','==',targetFloor)));
  let batch = writeBatch(db);
  let count = 0;
  const commits = [];
  snap.forEach(d => {
    batch.delete(d.ref);
    count++;
    if(count >= 450) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      count = 0;
    }
  });
  if(count > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function resetFloorState(targetFloor, options = {}) {
  const { includeParticipants = true } = options;
  const collections = [
    'notes',
    'sos',
    'songs',
    'cupid',
    'final',
    'stories',
    'popularity',
    'votes3rd',
    'signalVotes'
  ];
  if(includeParticipants) collections.unshift('participants');

  for(const collName of collections) {
    await deleteDocsForFloor(collName, targetFloor);
  }

  await Promise.allSettled([
    deleteDoc(doc(db, 'settings', TABLE_ROTATION_DOC)),
    deleteDoc(doc(db, 'settings', SIGNAL_VOTE_DOC)),
    deleteDoc(doc(db, 'settings', 'timer_' + targetFloor)),
    setDoc(doc(db, 'settings', 'party2'), { started: false }),
    setDoc(doc(db, 'settings', 'secondPart_' + targetFloor), { active: false }),
    setDoc(doc(db, 'settings', IMAGE_GAME_DOC), { questionIdx: 0 }),
    setDoc(doc(db, 'settings', BALANCE_GAME_DOC), { questionIdx: 0 })
  ]);
}

clearAllBtn.addEventListener('click', async () => {
  const floorName = getFloorFullName(adminFloor);
  if(!confirm(`${floorName}의 모든 기록을 삭제하시겠습니까?\n\n참가자, 요청, 선택, 투표, 로테이션, 타이머, 게임 진행 상태가 초기화됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
  
  try {
    await resetFloorState(adminFloor, { includeParticipants: true });
    alert(`${floorName} 모든 기록이 삭제되었습니다`);
  } catch(err) {
    console.error('Clear all error:', err);
    alert('삭제 중 오류가 발생했습니다');
  }
});

// 개별 삭제 함수들 (window에 노출하여 onclick에서 호출 가능하게)
window.deleteAllFromCollection = async function(collName, displayName) {
  if(!confirm(`${displayName}을(를) 모두 삭제하시겠습니까?`)) return;
  try {
    const snap = await getDocs(collection(db, collName));
    const deletePromises = [];
    snap.forEach(d => deletePromises.push(deleteDoc(doc(db, collName, d.id))));
    await Promise.all(deletePromises);
    alert(`${displayName}이(가) 모두 삭제되었습니다`);
  } catch(err) {
    console.error('Delete error:', err);
    alert('삭제 중 오류가 발생했습니다');
  }
}

removeAllParticipantsBtn.addEventListener('click', async () => {
  const floorName = getFloorFullName(adminFloor);
  if(!confirm(`${floorName}의 모든 참가자를 퇴장시키고 이전 참가자 기록을 정리하시겠습니까?\n\n참가자, 선택, 투표, 로테이션 기록이 초기화됩니다.`)) return;
  
  try {
    await resetFloorState(adminFloor, { includeParticipants: true });
    alert(`${floorName} 모든 참가자가 퇴장 처리되고 이전 기록이 정리되었습니다`);
  } catch(err) {
    console.error('Remove all participants error:', err);
    alert('퇴장 처리 중 오류가 발생했습니다');
  }
});

function loadAdminRealtime() {
  if(!adminFloor) { console.error('Admin floor not set'); return; }
  adminFirstLoad = true;
  lastSosCount = -1;
  lastSongCount = -1;
  
  listenTableRotationAdmin();
  listenTableMap(true);
  listenAdminVote3rd();
  listenGamesAdmin();
  listenParty2Admin();
  listenAdminTimer();

  if(adminParticipantsUnsub) { adminParticipantsUnsub(); adminParticipantsUnsub = null; }

  cleanupDuplicateParticipantsForFloor(adminFloor);

  const participantsQ = query(collection(db, 'participants'), where('floor','==',adminFloor));
  const participantCountEl = document.getElementById('participantCount');
  
  const maleCountEl = document.getElementById('maleCount');
  const femaleCountEl = document.getElementById('femaleCount');

  adminParticipantsUnsub = onSnapshot(participantsQ, snap => {
    adminParticipants.innerHTML='';

    // 닉네임+성별 중복 제거: tableNumber 있는 쪽 우선, 없으면 최신 joined
    const adminSeenNick = {};
    const adminDocs = [];
    snap.forEach(d => {
      const data = d.data();
      const key = getParticipantDedupeKey(data);
      if(adminSeenNick[key] === undefined) {
        adminSeenNick[key] = adminDocs.length;
        adminDocs.push({ id: d.id, ref: d.ref, data });
      } else {
        const prev = adminDocs[adminSeenNick[key]];
        if(isBetterParticipantRecord(data, prev.data)) adminDocs[adminSeenNick[key]] = { id: d.id, ref: d.ref, data };
      }
    });

    const count = adminDocs.length;
    if(participantCountEl) participantCountEl.textContent = `(${count}명)`;

    let maleCount = 0, femaleCount = 0;
    adminDocs.forEach(({ data }) => { if(data.gender === 'male') maleCount++; else if(data.gender === 'female') femaleCount++; });
    if(maleCountEl) maleCountEl.textContent = maleCount;
    if(femaleCountEl) femaleCountEl.textContent = femaleCount;
    
    adminDocs.forEach(({ id: docId, data }) => {
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.justifyContent = 'space-between';
      el.style.alignItems = 'center';
      el.style.padding = '12px';
      el.style.marginBottom = '10px';
      el.style.backgroundColor = 'rgba(100,200,255,0.08)';
      el.style.borderRadius = '8px';
      el.style.borderLeft = '3px solid #64c8ff';
      
      const infoEl = document.createElement('div');
      infoEl.style.display = 'flex';
      infoEl.style.alignItems = 'center';
      infoEl.style.gap = '8px';
      infoEl.style.flex = '1';
      infoEl.style.flexWrap = 'wrap';
      const floorText = getFloorText(data.floor);
      const secondPartyBadge = data.secondParty ? '<span style="background:#10b981; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">2차O</span>' : '<span style="background:#666; color:#ccc; padding:2px 6px; border-radius:4px; font-size:10px;">2차X</span>';
      const displayName = getParticipantDisplayName(data);
      const realNameDisplay = data.realName ? `<span style="color:#ffa500; font-size:13px; margin-left:4px;">(${escapeHtml(data.realName)})</span>` : '';
      infoEl.innerHTML = `<div style="font-weight:700; color:#64c8ff; font-size:15px;">${escapeHtml(displayName)}${realNameDisplay}</div><div style="color:#999; font-size:12px;">(${ data.gender === 'male' ? '남' : '여'} / ${escapeHtml(floorText)})</div>${secondPartyBadge}`;
      
      const btnContainer = document.createElement('div');
      btnContainer.style.display = 'flex';
      btnContainer.style.gap = '6px';
      
      // 2부 토글 버튼
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = data.secondParty ? '2차취소' : '2차신청';
      toggleBtn.style.padding = '6px 10px';
      toggleBtn.style.backgroundColor = data.secondParty ? '#f59e0b' : '#10b981';
      toggleBtn.style.color = '#fff';
      toggleBtn.style.border = 'none';
      toggleBtn.style.borderRadius = '4px';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.style.fontSize = '11px';
      toggleBtn.style.fontWeight = '600';
      toggleBtn.addEventListener('click', async () => {
        try {
          const newVal = !data.secondParty;
          await updateDoc(doc(db, 'participants', docId), { secondParty: newVal });
        } catch(err) {
          alert('변경 중 오류가 발생했습니다');
        }
      });
      
      const exitBtn = document.createElement('button');
      exitBtn.textContent = '퇴장';
      exitBtn.style.padding = '6px 12px';
      exitBtn.style.backgroundColor = '#ff6464';
      exitBtn.style.color = '#fff';
      exitBtn.style.border = 'none';
      exitBtn.style.borderRadius = '4px';
      exitBtn.style.cursor = 'pointer';
      exitBtn.style.fontSize = '12px';
      exitBtn.style.fontWeight = '600';
      exitBtn.addEventListener('click', async () => {
        if(confirm(`${displayName}를 퇴장시키시겠습니까?`)) {
          try {
            await deleteDoc(doc(db, 'participants', docId));
            alert(`${displayName}가 퇴장 처리되었습니다`);
          } catch(err) {
            alert('오류가 발생했습니다');
          }
        }
      });
      
      btnContainer.appendChild(toggleBtn);
      btnContainer.appendChild(exitBtn);
      
      el.appendChild(infoEl);
      el.appendChild(btnContainer);
      adminParticipants.appendChild(el);
    });
  });

  const sosQ = query(collection(db, 'sos'), where('floor','==',adminFloor));
  onSnapshot(sosQ, snap => {
    adminSOS.innerHTML='';
    const allSOS = [];
    snap.forEach(d => {
      allSOS.push(d.data());
    });
    allSOS.sort((a, b) => b.time - a.time);
    
    if(!adminFirstLoad && lastSosCount >= 0 && allSOS.length > lastSosCount) {
      const newSOS = allSOS[0];
      alert(`🆘 새 SOS 요청!\n\n${newSOS.fromName}: ${newSOS.reason || '(사유 없음)'}`);
    }
    lastSosCount = allSOS.length;
    
    allSOS.forEach(data => {
      const el = document.createElement('div');
      el.style.padding = '12px';
      el.style.marginBottom = '8px';
      el.style.backgroundColor = 'rgba(255,100,100,0.1)';
      el.style.borderRadius = '8px';
      el.style.borderLeft = '3px solid #ff6464';
      el.innerHTML = `<div style="font-weight:700; color:#ff6464; font-size:15px;">🆘 ${escapeHtml(data.fromName)}</div><div style="color:#bdbdbd; font-size:13px; margin-top:4px;">${escapeHtml(data.reason || '(사유 없음)')}</div>`;
      adminSOS.appendChild(el);
    });
  });

  const storiesQ = query(collection(db, 'stories'), where('floor','==',adminFloor));
  onSnapshot(storiesQ, snap => {
    adminStories.innerHTML='';
    if(snap.empty) { adminStories.textContent = '사연이 없습니다'; return; }
    const allStories = [];
    snap.forEach(d => {
      allStories.push(d.data());
    });
    // 시간순 정렬
    allStories.sort((a, b) => b.time - a.time);
    allStories.forEach(data => {
      const el = document.createElement('div');
      el.style.padding = '12px';
      el.style.marginBottom = '10px';
      el.style.backgroundColor = 'rgba(186,85,211,0.1)';
      el.style.borderRadius = '8px';
      el.style.borderLeft = '3px solid #ba55d3';
      el.innerHTML = `<div style="font-weight:700; color:#ba55d3; font-size:15px;">💭 ${escapeHtml(data.fromName)}</div><div style="color:#bdbdbd; font-size:13px; margin-top:4px; line-height:1.5;">${escapeHtml(data.story)}</div>`;
      adminStories.appendChild(el);
    });
  });

  const songsQ = query(collection(db, 'songs'), where('floor','==',adminFloor));
  onSnapshot(songsQ, snap => {
    adminSongs.innerHTML='';
    const allSongs = [];
    snap.forEach(d => {
      allSongs.push(d.data());
    });
    allSongs.sort((a, b) => b.time - a.time);
    
    if(!adminFirstLoad && lastSongCount >= 0 && allSongs.length > lastSongCount) {
      const newSong = allSongs[0];
      alert(`🎵 새 노래 요청!\n\n${newSong.fromName}: ${newSong.title} - ${newSong.artist}`);
    }
    lastSongCount = allSongs.length;
    adminFirstLoad = false;
    
    allSongs.forEach(data => {
      const el = document.createElement('div');
      el.style.padding = '12px';
      el.style.marginBottom = '10px';
      el.style.backgroundColor = 'rgba(135,206,235,0.1)';
      el.style.borderRadius = '8px';
      el.style.borderLeft = '3px solid #87ceeb';
      el.innerHTML = `<div style="font-weight:700; color:#87ceeb; margin-bottom:4px; font-size:15px;">🎵 ${escapeHtml(data.title)}</div><div style="color:#bdbdbd; font-size:14px;">${escapeHtml(data.artist)}</div>`;
      adminSongs.appendChild(el);
    });
  });

  const finalQ = query(collection(db, 'final'), where('floor','==',adminFloor));
  onSnapshot(finalQ, snap => {
    adminFinal.innerHTML='';
    
    // 커플 자동감지 로직
    const selections = {};
    const allFinal = [];
    snap.forEach(d => {
      const data = d.data();
      allFinal.push(data);
      const fromName = data.fromName;
      const toName = data.toName || data.toId;
      if(!selections[fromName]) selections[fromName] = [];
      selections[fromName].push(toName);
    });
    
    // 시간순 정렬
    allFinal.sort((a, b) => b.time - a.time);
    
    // 상호 선택된 커플 찾기
    const couples = [];
    const processed = new Set();
    
    Object.keys(selections).forEach(person1 => {
      selections[person1].forEach(person2 => {
        if(!processed.has(`${person1}-${person2}`) && !processed.has(`${person2}-${person1}`)) {
          if(selections[person2] && selections[person2].includes(person1)) {
            couples.push({person1, person2});
            processed.add(`${person1}-${person2}`);
            processed.add(`${person2}-${person1}`);
          }
        }
      });
    });
    
    // 커플탄생 표시
    adminCouples.innerHTML='';
    const adminCoupleContacts = document.getElementById('adminCoupleContacts');
    if(adminCoupleContacts) adminCoupleContacts.innerHTML = '';
    
    if(couples.length === 0) {
      adminCouples.textContent = '아직 커플이 없습니다';
      if(adminCoupleContacts) adminCoupleContacts.innerHTML = '<div style="color:#999; font-size:13px;">커플이 매칭되면 연락처가 표시됩니다</div>';
    } else {
      couples.forEach(couple => {
        const el = document.createElement('div');
        el.style.padding = '12px';
        el.style.marginBottom = '10px';
        el.style.backgroundColor = 'rgba(255,105,180,0.15)';
        el.style.borderRadius = '8px';
        el.style.borderLeft = '3px solid #ff69b4';
        el.style.textAlign = 'center';
        el.style.fontSize = '16px';
        el.style.fontWeight = '700';
        el.style.color = '#ff69b4';
        el.textContent = `${couple.person1} 💝 ${couple.person2}`;
        adminCouples.appendChild(el);
      });
      
      // 커플 연락처 표시
      if(adminCoupleContacts) {
        const coupleNicknames = new Set();
        couples.forEach(c => { coupleNicknames.add(c.person1); coupleNicknames.add(c.person2); });
        
        getDocs(query(collection(db, 'participants'), where('floor','==',adminFloor)))
          .then(pSnap => {
            const nicknameMap = {};
            pSnap.forEach(p => {
              const d = p.data();
              nicknameMap[d.nickname] = { realName: d.realName || '-', phoneNumber: d.phoneNumber || '-' };
            });
            
            let contactHtml = '';
            couples.forEach((couple, idx) => {
              const p1 = nicknameMap[couple.person1] || { realName: '-', phoneNumber: '-' };
              const p2 = nicknameMap[couple.person2] || { realName: '-', phoneNumber: '-' };
              contactHtml += `<div style="background:rgba(255,105,180,0.1); border-radius:8px; padding:12px; margin-bottom:8px; border-left:3px solid #ff69b4;">`;
              contactHtml += `<div style="color:#ff69b4; font-weight:700; margin-bottom:8px;">💝 커플 ${idx+1}</div>`;
              contactHtml += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
              contactHtml += `<div style="flex:1; min-width:120px; background:rgba(0,0,0,0.2); border-radius:6px; padding:8px;">`;
              contactHtml += `<div style="color:#64c8ff; font-size:12px; margin-bottom:4px;">닉네임: ${escapeHtml(couple.person1)}</div>`;
              contactHtml += `<div style="color:#fff; font-size:14px; font-weight:600;">${escapeHtml(p1.realName)}</div>`;
              contactHtml += `<div style="color:#bdbdbd; font-size:13px;">${escapeHtml(p1.phoneNumber)}</div></div>`;
              contactHtml += `<div style="flex:1; min-width:120px; background:rgba(0,0,0,0.2); border-radius:6px; padding:8px;">`;
              contactHtml += `<div style="color:#ff69b4; font-size:12px; margin-bottom:4px;">닉네임: ${escapeHtml(couple.person2)}</div>`;
              contactHtml += `<div style="color:#fff; font-size:14px; font-weight:600;">${escapeHtml(p2.realName)}</div>`;
              contactHtml += `<div style="color:#bdbdbd; font-size:13px;">${escapeHtml(p2.phoneNumber)}</div></div>`;
              contactHtml += `</div></div>`;
            });
            adminCoupleContacts.innerHTML = contactHtml;
          });
      }
    }
    
    // 최종선택 집계 표시
    snap.forEach(d => {
      const data = d.data();
      const el = document.createElement('div');
      el.style.padding = '12px';
      el.style.marginBottom = '10px';
      el.style.backgroundColor = 'rgba(218,165,32,0.08)';
      el.style.borderRadius = '8px';
      el.style.borderLeft = '3px solid #daa520';
      el.innerHTML = `<div style="font-weight:700; color:#daa520; font-size:15px;">${escapeHtml(data.fromName)} → ${escapeHtml(data.toName || data.toId)}</div>`;
      adminFinal.appendChild(el);
    });
    
  });
  
  // 호감도 실시간 업데이트
  listenAdminPopularity();
}

// 관리자 호감도 실시간 리스너
let adminPopularityVersion = 0; // 버전 관리로 비동기 충돌 방지

function listenAdminVote3rd() {
  let _aFemale = 0, _aMale = 0, _aYes = 0;
  let _aSeedFemale = 0, _aSeedMale = 0;

  function _renderAdminVote3rd() {
    const femaleEl   = document.getElementById('adminVote3rdFemale');
    const maleEl     = document.getElementById('adminVote3rdMale');
    const totalEl    = document.getElementById('adminVote3rdTotal');
    const seedInfoEl = document.getElementById('adminVote3rdSeedInfo');
    const ft = _aFemale + _aSeedFemale;
    const mt = _aMale   + _aSeedMale;
    if(femaleEl)   femaleEl.textContent   = ft;
    if(maleEl)     maleEl.textContent     = mt;
    if(totalEl)    totalEl.textContent    = ft + mt;
    if(seedInfoEl) seedInfoEl.textContent = `시딩: 여성 ${_aSeedFemale} · 남성 ${_aSeedMale}`;
  }

  // 투표 리스너
  const q = query(collection(db, 'votes3rd'), where('floor','==',adminFloor));
  onSnapshot(q, snap => {
    let yesCount = 0, femaleCount = 0, maleCount = 0;
    const yesList = [];
    snap.forEach(d => {
      const v = d.data();
      if(v.vote === 'yes') {
        yesCount++;
        if(v.gender === 'female') femaleCount++;
        else if(v.gender === 'male') maleCount++;
        yesList.push(v.nickname || '?');
      }
    });
    _aYes = yesCount; _aFemale = femaleCount; _aMale = maleCount;
    _renderAdminVote3rd();
    const listEl = document.getElementById('adminVote3rdList');
    if(listEl) {
      let html = '';
      if(yesList.length) html += `<div><span style="color:#ff8fbd;font-weight:700;">✅ 참여 확정 (${yesCount}명):</span><br><span style="color:#ccc;">${yesList.join(', ')}</span></div>`;
      listEl.innerHTML = html || '<span style="color:#555;font-size:11px;">아직 참여 없음</span>';
    }
  });

  // 시딩 리스너
  const seedRef = doc(db, 'settings', `vote3rdSeed_${adminFloor}`);
  onSnapshot(seedRef, snap => {
    const data = snap.exists() ? snap.data() : {};
    _aSeedFemale = data.female || 0;
    _aSeedMale   = data.male   || 0;
    _renderAdminVote3rd();
  });

  // 시딩 버튼
  async function addSeed(genderKey) {
    const ref  = doc(db, 'settings', `vote3rdSeed_${adminFloor}`);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { female:0, male:0 };
    data[genderKey] = (data[genderKey] || 0) + 1;
    await setDoc(ref, data);
  }
  const sfBtn = document.getElementById('seedFemaleBtn');
  const smBtn = document.getElementById('seedMaleBtn');
  if(sfBtn) sfBtn.addEventListener('click', () => addSeed('female'));
  if(smBtn) smBtn.addEventListener('click', () => addSeed('male'));

  // 초기화 버튼
  const resetBtn = document.getElementById('resetVote3rdBtn');
  if(resetBtn) resetBtn.addEventListener('click', async () => {
    if(!confirm('3부 투표를 초기화하시겠습니까?\n(시딩 데이터도 함께 삭제됩니다)')) return;
    const snap = await getDocs(query(collection(db, 'votes3rd'), where('floor','==',adminFloor)));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'votes3rd', d.id))));
    await setDoc(doc(db, 'settings', `vote3rdSeed_${adminFloor}`), { female:0, male:0 });
    alert('3부 투표가 초기화되었습니다');
  });
}

function listenAdminPopularity() {
  const adminPopularity = document.getElementById('adminPopularity');
  if(!adminPopularity || !adminFloor) return;

  const popQ = query(collection(db, 'popularity'), where('floor','==',adminFloor));
  onSnapshot(popQ, async snap => {
    const currentVersion = ++adminPopularityVersion;

    if(snap.empty) {
      if(currentVersion === adminPopularityVersion) {
        adminPopularity.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:13px; padding:16px 0; text-align:center;">아직 호감 데이터가 없습니다</div>';
      }
      return;
    }

    const participantsSnap = await getDocs(query(collection(db, 'participants'), where('floor','==',adminFloor)));
    if(currentVersion !== adminPopularityVersion) return;

    const participantMap = {};
    participantsSnap.forEach(p => { participantMap[p.id] = p.data(); });

    // 호감 raw 목록
    const likes = [];
    snap.forEach(d => { likes.push(d.data()); });

    // 받은 호감 집계 (id 기준)
    const receivedMap = {}; // toId → { count, name, gender, senders: [fromName] }
    const sentMap = {};     // fromId → [toId, ...]
    likes.forEach(like => {
      const to = participantMap[like.toId];
      const from = participantMap[like.fromId];
      if(to) {
        if(!receivedMap[like.toId]) receivedMap[like.toId] = { count:0, name: getParticipantDisplayName(to), gender: to.gender, realName: to.realName||'', senders:[] };
        receivedMap[like.toId].count++;
        receivedMap[like.toId].senders.push(from ? getParticipantDisplayName(from) : (like.fromName||'?'));
      }
      if(!sentMap[like.fromId]) sentMap[like.fromId] = [];
      sentMap[like.fromId].push(like.toId);
    });

    // 상호 호감 쌍 탐색 (fromId → toId 양방향)
    const sentSet = {};
    likes.forEach(like => { sentSet[`${like.fromId}_${like.toId}`] = true; });
    const mutualPairs = [];
    const mutualSeen = new Set();
    likes.forEach(like => {
      const key1 = `${like.fromId}_${like.toId}`;
      const key2 = `${like.toId}_${like.fromId}`;
      const pairKey = [like.fromId, like.toId].sort().join('_');
      if(sentSet[key1] && sentSet[key2] && !mutualSeen.has(pairKey)) {
        mutualSeen.add(pairKey);
        const p1 = participantMap[like.fromId];
        const p2 = participantMap[like.toId];
        mutualPairs.push({
          name1: p1 ? getParticipantDisplayName(p1) : (like.fromName||'?'),
          name2: p2 ? getParticipantDisplayName(p2) : (like.toName||'?'),
          gender1: p1?.gender, gender2: p2?.gender
        });
      }
    });

    if(currentVersion !== adminPopularityVersion) return;

    const males   = Object.entries(receivedMap).filter(([,v]) => v.gender === 'male').sort((a,b) => b[1].count - a[1].count);
    const females = Object.entries(receivedMap).filter(([,v]) => v.gender === 'female').sort((a,b) => b[1].count - a[1].count);
    const maxCount = Math.max(1, ...Object.values(receivedMap).map(v => v.count));

    const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}위`;

    const renderRankRow = (id, v, idx) => {
      const pct = Math.round((v.count / maxCount) * 100);
      const barColor = v.gender === 'female' ? 'rgba(244,114,182,0.7)' : 'rgba(96,165,250,0.7)';
      const senderNames = v.senders.join(', ');
      return `
        <div style="margin-bottom:10px; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <span style="font-size:14px; min-width:24px;">${medal(idx)}</span>
            <span style="font-weight:800; font-size:14px; color:#fff;">${escapeHtml(v.name)}</span>
            ${v.realName ? `<span style="font-size:11px; color:rgba(255,255,255,0.5);">${escapeHtml(v.realName)}</span>` : ''}
            <span style="margin-left:auto; font-size:13px; font-weight:900; color:${v.gender==='female'?'#f472b6':'#60a5fa'};">💚${v.count}</span>
          </div>
          <div style="height:5px; border-radius:999px; background:rgba(255,255,255,0.08); overflow:hidden; margin-bottom:6px;">
            <div style="height:100%; width:${pct}%; background:${barColor}; border-radius:999px; transition:width 0.4s;"></div>
          </div>
          <div style="font-size:11px; color:rgba(255,255,255,0.45); line-height:1.4;">← ${escapeHtml(senderNames)}</div>
        </div>`;
    };

    let html = '';

    // ── 요약 통계 ──
    html += `<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:16px;">
      <div style="padding:12px 10px; border-radius:12px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); text-align:center;">
        <div style="font-size:22px; font-weight:900; color:#4ade80;">${likes.length}</div>
        <div style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.5); margin-top:2px;">총 호감</div>
      </div>
      <div style="padding:12px 10px; border-radius:12px; background:rgba(244,114,182,0.1); border:1px solid rgba(244,114,182,0.2); text-align:center;">
        <div style="font-size:22px; font-weight:900; color:#f472b6;">${mutualPairs.length}</div>
        <div style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.5); margin-top:2px;">상호 호감</div>
      </div>
      <div style="padding:12px 10px; border-radius:12px; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.2); text-align:center;">
        <div style="font-size:22px; font-weight:900; color:#c084fc;">${Object.keys(sentMap).length}</div>
        <div style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.5); margin-top:2px;">보낸 참가자</div>
      </div>
    </div>`;

    // ── 상호 호감 목록 ──
    if(mutualPairs.length > 0) {
      html += `<div style="margin-bottom:16px; padding:14px; border-radius:14px; background:linear-gradient(135deg,rgba(244,114,182,0.12),rgba(168,85,247,0.1)); border:1px solid rgba(244,114,182,0.25);">
        <div style="font-size:12px; font-weight:900; color:#f472b6; letter-spacing:.06em; margin-bottom:10px;">💕 맞호감 (상호 호감)</div>
        <div style="display:grid; gap:7px;">`;
      mutualPairs.forEach(pair => {
        html += `<div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:9px; background:rgba(255,255,255,0.06);">
          <span style="font-weight:800; font-size:13px; color:#fff;">${escapeHtml(pair.name1)}</span>
          <span style="color:#f472b6; font-size:14px;">💚💚</span>
          <span style="font-weight:800; font-size:13px; color:#fff;">${escapeHtml(pair.name2)}</span>
        </div>`;
      });
      html += `</div></div>`;
    }

    // ── 성별별 랭킹 ──
    html += `<div style="display:grid; gap:12px;">`;

    // 여자 랭킹
    if(females.length > 0) {
      html += `<div style="padding:14px; border-radius:14px; background:rgba(244,114,182,0.07); border:1px solid rgba(244,114,182,0.18);">
        <div style="font-size:12px; font-weight:900; color:#f472b6; letter-spacing:.06em; margin-bottom:12px;">🙋‍♀️ 여자 받은 호감 랭킹</div>`;
      females.forEach(([id, v], idx) => { html += renderRankRow(id, v, idx); });
      html += `</div>`;
    }

    // 남자 랭킹
    if(males.length > 0) {
      html += `<div style="padding:14px; border-radius:14px; background:rgba(96,165,250,0.07); border:1px solid rgba(96,165,250,0.18);">
        <div style="font-size:12px; font-weight:900; color:#60a5fa; letter-spacing:.06em; margin-bottom:12px;">🙋‍♂️ 남자 받은 호감 랭킹</div>`;
      males.forEach(([id, v], idx) => { html += renderRankRow(id, v, idx); });
      html += `</div>`;
    }

    html += `</div>`;

    if(currentVersion === adminPopularityVersion) {
      adminPopularity.innerHTML = html;
    }
  });
}


function listenAdminRealtime() {
  const q = query(collection(db, 'participants'));
  onSnapshot(q, snap => {
    announcements.innerHTML = `<div style="font-weight:bold; color:#ff3c87;">👥 총 참가자수: ${snap.size}명</div>`;
  });
}

function listenCupidArrows() {
  // 층별 필터링 적용
  const q = query(collection(db, 'cupid'), where('floor','==',floor));
  onSnapshot(q, snap => {
    if(cupidNotifications) cupidNotifications.innerHTML='';
    const allArrows = [];
    snap.forEach(d => {
      allArrows.push(d.data());
    });
    // 시간순 정렬
    allArrows.sort((a, b) => b.time - a.time);
    
    const myArrows = allArrows.filter(d => d.toId === participantDocId);
    
    // 새로운 화살이 도착했는지 확인 및 팝업 표시
    if(myArrows.length > lastCupidCount) {
      const newArrow = myArrows[0];
      alert(`💘 ${newArrow.fromName}님이 본인에게 큐피드의 화살로 관심을 표현했습니다!`);
    }
    lastCupidCount = myArrows.length;

    if(!cupidNotifications) return;
    
    if(myArrows.length === 0) {
      cupidNotifications.textContent = '아직 화살을 받지 않았습니다';
      return;
    }
    
    myArrows.forEach(data => {
      const el = document.createElement('div');
      el.style.padding = '12px';
      el.style.marginBottom = '10px';
      el.style.backgroundColor = 'rgba(255,60,135,0.1)';
      el.style.borderRadius = '8px';
      el.style.borderLeft = '3px solid #ff3c87';
      el.style.fontWeight = '600';
      el.style.color = '#ff3c87';
      el.style.fontSize = '15px';
      el.textContent = `💘 ${data.fromName}`;
      cupidNotifications.appendChild(el);
    });
  });
}

// 타이머 기능 (층별 분리)
let timerFirstLoad = true;
let lastRemaining = -1;

// listenTimer: onSnapshot을 한 번만 등록하고 endTime을 변수에 저장
// setInterval에서 저장된 endTime으로 화면 업데이트 (매 초 새 리스너 생성 방지)
function listenTimer() {
  if(!floor) return;
  if(_timerUnsub) { _timerUnsub(); _timerUnsub = null; }
  const timerDocId = 'timer_' + floor;
  timerFirstLoad = true;
  lastRemaining = -1;

  _timerUnsub = onSnapshot(doc(db, 'settings', timerDocId), (docSnap) => {
    if(!docSnap.exists() || !docSnap.data().active) {
      _timerIsActive = false;
      _timerEndTime = 0;
      timerDisplay.classList.add('hidden');
      timerAlertShown = false;
      timerFirstLoad = false;
      lastRemaining = -1;
      return;
    }
    const data = docSnap.data();
    _timerEndTime = data.endTime;
    _timerIsActive = true;
    timerDisplay.classList.remove('hidden');
    const remaining = Math.max(0, Math.floor((_timerEndTime - Date.now()) / 1000));
    if(timerFirstLoad) {
      timerFirstLoad = false;
      lastRemaining = remaining;
      if(remaining <= 0) {
        timerAlertShown = true;
        timerText.textContent = '00:00';
        timerText.style.color = '#ff6464';
      }
    }
  });
}

// 관리자 타이머 시작 (층별)
startTimerBtn?.addEventListener('click', async () => {
  if(!adminFloor) { alert('층을 먼저 선택하세요'); return; }
  const mins = parseInt(timerMinutes.value) || 13;
  const endTime = Date.now() + mins * 60 * 1000;
  const timerDocId = 'timer_' + adminFloor;
  try {
    await setDoc(doc(db, 'settings', timerDocId), { active: true, endTime, minutes: mins });
    const floorName = getFloorText(adminFloor);
    adminTimerStatus.textContent = `⏱️ ${floorName} ${mins}분 타이머 실행중`;
    adminTimerStatus.style.color = '#4ade80';
  } catch(err) {
    console.error('Timer start error:', err);
  }
});

// 관리자 타이머 중지 (층별)
stopTimerBtn?.addEventListener('click', async () => {
  if(!adminFloor) return;
  const timerDocId = 'timer_' + adminFloor;
  try {
    await setDoc(doc(db, 'settings', timerDocId), { active: false, endTime: 0 });
    adminTimerStatus.textContent = '타이머 중지됨';
    adminTimerStatus.style.color = '#ff9ebc';
  } catch(err) {
    console.error('Timer stop error:', err);
  }
});

// 관리자 타이머 상태 (층별) — onSnapshot 한 번만 등록, endTime 변수에 저장
function listenAdminTimer() {
  if(!adminFloor) return;
  if(_adminTimerUnsub) { _adminTimerUnsub(); _adminTimerUnsub = null; }
  const timerDocId = 'timer_' + adminFloor;
  _adminTimerUnsub = onSnapshot(doc(db, 'settings', timerDocId), (docSnap) => {
    if(!docSnap.exists() || !docSnap.data().active) {
      _adminTimerIsActive = false;
      _adminTimerEndTime = 0;
      if(adminTimerStatus) adminTimerStatus.textContent = '타이머 대기중';
      return;
    }
    const data = docSnap.data();
    _adminTimerEndTime = data.endTime;
    _adminTimerIsActive = true;
  });
}

// 타이머 화면 1초마다 업데이트 (Firebase 재호출 없이 저장된 endTime 사용)
setInterval(() => {
  if(_timerIsActive && _timerEndTime) {
    const remaining = Math.max(0, Math.floor((_timerEndTime - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    timerText.style.color = remaining <= 60 ? '#ff6464' : '#fff';

    if(remaining <= 0 && lastRemaining > 0 && !timerAlertShown) {
      timerAlertShown = true;
      timerText.textContent = '00:00';
      timerText.style.color = '#ff6464';
      if(navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdnd3eHlzb2tnaWxucHJycnBua2hoampqampra2tsbGxsbGxsbGxsbGtra2tra2pqamlpaWhoaGdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnaGhoaWlpamlqamtrbGxtbW1tbW1tbGtra2ppaWhoZ2dnZmZmZWVlZGRkY2NjYmJiYmFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWBgYGBgYGBgYGBgYGBgYGBgYGBgYF9fX19fX19fX19fX19fX19fXw==');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch(e) {}
      let msg = '🔔 현재 라운드가 종료되었습니다!';
      if(gender === 'male') msg += '\n\n👨 남성 참가자분들은 다음 테이블로 이동해주세요!';
      alert(msg);
    } else if(remaining > 0) {
      timerAlertShown = false;
    }
    lastRemaining = remaining;
  }

  if(_adminTimerIsActive && _adminTimerEndTime && adminTimerStatus && adminFloor && adminPanel && !adminPanel.classList.contains('hidden')) {
    const remaining = Math.max(0, Math.floor((_adminTimerEndTime - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const floorName = getFloorText(adminFloor);
    adminTimerStatus.textContent = `⏱️ ${floorName} 남은시간: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    adminTimerStatus.style.color = remaining <= 60 ? '#ff6464' : '#4ade80';
  }
}, 1000);


// 2부 파티 상태 리스너 (참가자용)
function listenSecondPartStatus() {
  if(!floor) return;
  const statusDocId = 'secondPart_' + floor;
  const teamInfoDisplay = document.getElementById('teamInfoDisplay');
  const teamNumberText = document.getElementById('teamNumberText');
  
  onSnapshot(doc(db, 'settings', statusDocId), async (docSnap) => {
    if(!docSnap.exists() || docSnap.data().active !== true) {
      isSecondPartActive = false;
      if(teamInfoDisplay) teamInfoDisplay.classList.add('hidden');
      if(partyStatus) {
        partyStatus.textContent = '🎉 1부 진행중';
        partyStatus.style.color = '#10b981';
      }
      const homePartyStatus = document.getElementById('homePartyStatus');
      const homePartyBadge = document.getElementById('homePartyBadge');
      if(homePartyStatus) homePartyStatus.textContent = '1부 진행 중';
      if(homePartyBadge) homePartyBadge.textContent = '1부 진행 중';
      updateMyStatusCards();
      renderLikeStatusDashboard();
      updateTableMaps();
      // 1부로 돌아갈 때 목록 새로고침 (이름 숨김)
      listenOppositeList();
      return;
    }
    
    isSecondPartActive = true;
    
    // 파티 상태 업데이트
    if(partyStatus) {
      partyStatus.textContent = '🎊 2부 진행중';
      partyStatus.style.color = '#4ade80';
    }
    const homePartyStatus = document.getElementById('homePartyStatus');
    const homePartyBadge = document.getElementById('homePartyBadge');
    if(homePartyStatus) homePartyStatus.textContent = '2부 진행 중';
    if(homePartyBadge) homePartyBadge.textContent = '2부 진행 중';
    updateMyStatusCards();
    renderLikeStatusDashboard();
    updateTableMaps();
    
    // 팀 번호 표시 (팀 인원 남녀 구성 포함)
    if(teamInfoDisplay && participantDocId) {
      teamInfoDisplay.classList.remove('hidden');
      try {
        const participantSnap = await getDoc(doc(db, 'participants', participantDocId));
        if(participantSnap.exists()) {
          const data = participantSnap.data();
          if(data.teamNumber) {
            const teamFloors = [floor];
            const teamQ = query(collection(db, 'participants'), where('teamNumber','==',data.teamNumber), where('floor','in',teamFloors));
            const teamSnap = await getDocs(teamQ);
            let teamMales = 0, teamFemales = 0;
            teamSnap.forEach(d => {
              if(d.data().gender === 'male') teamMales++;
              else teamFemales++;
            });
            if(teamNumberText) {
              teamNumberText.style.display = 'block';
              teamNumberText.textContent = `🎯 ${data.teamNumber}팀 ( 남${teamMales}, 여${teamFemales} )`;
            }
          } else {
            if(teamNumberText) {
              teamNumberText.textContent = '';
              teamNumberText.style.display = 'none';
            }
          }
        }
      } catch(e) {
        console.error('팀 번호 조회 오류:', e);
      }
    }
    
    // 2부 시작 시 목록 새로고침 (이름 표시)
    listenOppositeList();
  });
}



// ─────────────────────────────────────────────────────────────
// 자리 배치 (Table Rotation) — participant side
// ─────────────────────────────────────────────────────────────
const TABLE_ROTATION_DOC = 'tableRotation';
const TOTAL_TABLES = 14;

let tableRotationUnsub = null;
let tableRotationSettleTimer = null;
let tableRotationActive = false;  // 현재 rotation 진행 여부
let tableRotationRound = 0;       // 현재 round

function setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, tableNum, round) {
  nextTableDisplay.textContent = tableNum || '-';
  nextTableDisplay.style.color = '#fff';
  card.style.borderColor = '#ffc107';
  card.style.background = 'linear-gradient(135deg, rgba(255,193,7,0.3), rgba(255,193,7,0.15))';
  if(gender === 'female') {
    tableRotationMsg.textContent = '고정 좌석';
    myCurrentTableEl.textContent = '';
  } else {
    tableRotationMsg.textContent = round > 0 ? `${round}R 완료` : '현재 테이블';
    myCurrentTableEl.textContent = round > 0 ? '다음 로테이션까지 대기' : '';
  }
  tableRotationMsg.style.color = '#ffd700';
}

function getParticipantCurrentTableValue(p) {
  const value = p.gender === 'male' ? (p.currentTable || p.tableNumber) : p.tableNumber;
  const table = Number(value);
  return table >= 1 && table <= TOTAL_TABLES ? table : null;
}

function listenTableRotation() {
  const card = document.getElementById('tableRotationCard');
  const nextTableDisplay = document.getElementById('nextTableDisplay');
  const tableRotationMsg = document.getElementById('tableRotationMsg');
  const myCurrentTableEl = document.getElementById('myCurrentTable');
  if(!card) return;
  if(isStaff) { card.style.display = 'none'; return; }

  // 즉시 현재 테이블 표시 (배치 전 기본 상태)
  card.style.display = 'block';
  setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, myCurrentTable || tableNumber, null);

  if(tableRotationUnsub) tableRotationUnsub();

  tableRotationUnsub = onSnapshot(doc(db, 'settings', TABLE_ROTATION_DOC), (snap) => {
    if(tableRotationSettleTimer) { clearTimeout(tableRotationSettleTimer); tableRotationSettleTimer = null; }

    // 배치 데이터 없음 → 현재 테이블 표시 유지
    if(!snap.exists()) {
      setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, myCurrentTable || tableNumber, null);
      return;
    }

    const data = snap.data();
    tableRotationRound = data.round || 0;
    tableRotationActive = data.active || false;
    showRotationCard(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl);
  });

  // 카드 표시 로직 분리 — participant onSnapshot에서도 호출 가능
  function showRotationCard(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl) {
    if(tableRotationSettleTimer) { clearTimeout(tableRotationSettleTimer); tableRotationSettleTimer = null; }

    if(!tableRotationActive) {
      setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, myCurrentTable || tableNumber, tableRotationRound > 0 ? tableRotationRound : null);
      return;
    }

    if(gender === 'female') {
      setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, tableNumber, tableRotationRound);
      renderNotesList();
      return;
    }

    // 남자: myCurrentTable = participant 문서의 currentTable 필드
    // currentTable이 없으면(이번 라운드 미포함 → 늦게 합류) 그냥 현재 자리 표시
    const dest = myCurrentTable && myCurrentTable !== tableNumber ? myCurrentTable : null;

    if(dest) {
      renderNotesList();
      nextTableDisplay.textContent = dest;
      nextTableDisplay.style.color = '#ff6eb4';
      tableRotationMsg.textContent = `${dest}번으로 이동`;
      tableRotationMsg.style.color = '#ff6eb4';
      myCurrentTableEl.textContent = tableRotationRound > 0 ? `${tableRotationRound}R 진행 중` : '이동 중';
      card.style.borderColor = '#ff6eb4';
      card.style.background = 'linear-gradient(135deg, rgba(255,110,180,0.35), rgba(255,110,180,0.15))';
      tableRotationSettleTimer = setTimeout(() => {
        setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, dest, tableRotationRound);
        tableRotationSettleTimer = null;
      }, 60000);
    } else {
      // currentTable 없음 = 이번 라운드엔 이동 없음 (늦게 합류하거나 이미 완료)
      // 현재 tableNumber를 그대로 표시, 다음 라운드에 자동 포함됨
      setCardSettled(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl, myCurrentTable || tableNumber, tableRotationRound);
    }
  }

  // participant onSnapshot에서 myCurrentTable 바뀌면 카드 즉시 갱신
  window._refreshRotationCard = () => {
    showRotationCard(card, nextTableDisplay, tableRotationMsg, myCurrentTableEl);
  };
}

// ─────────────────────────────────────────────────────────────
// 테이블 배치도
// ─────────────────────────────────────────────────────────────
let tableMapParticipantsData = [];
let tableMapParticipantsUnsub = null;
let tableMapRotationUnsub = null;
let adminParticipantsUnsub = null;

// 테이블 레이아웃 특수 셀 상수
const CELL_TOILET   = 'TOILET';    // 화장실
const CELL_ENTRANCE = 'ENTRANCE';  // 입구 (화장실 오른쪽)
const CELL_KITCHEN  = 'KITCHEN';   // 주방
const CELL_PILLAR   = 'PILLAR';    // 기둥
const CELL_WINDOW     = 'WINDOW';      // 창가
const CELL_PROJECTOR  = 'PROJECTOR';   // 빔프로젝터

// 7열 그리드 레이아웃
// Row0: 화장실 | 입구 | 기둥 | 기둥 | 기둥 | (빈) | 14번
// Row1: 주방   |  13번 | 12번 | 11번 | 10번 | (빈) | (빈)
// Row2: (빈)   |   9번 | 기둥 | (빈) | (빈) |  8번 | (빈)
// Row3: (빈)   |   7번 | (빈) |  6번 | (빈) |  5번 | (빈)
// Row4: (빈)   |   4번 |  3번 | (빈) |  2번 |  1번 | (빈)
const TABLE_LAYOUT = [
  [CELL_TOILET,  CELL_ENTRANCE, CELL_PILLAR, CELL_PILLAR, CELL_PILLAR, 14,          CELL_WINDOW],
  [CELL_KITCHEN, 13,            12,          11,          10,          null,        CELL_WINDOW],
  [CELL_PROJECTOR, 9,            CELL_PILLAR, null,        null,          8,         CELL_WINDOW],
  [CELL_PROJECTOR, 7,            null,         6,           null,          5,        CELL_WINDOW],
  [CELL_PROJECTOR, 4,             3,           null,         2,            1,        CELL_WINDOW]
];
const KITCHEN_TABLE = null;

function renderTableMap(container, participants, isAdmin = false) {
  if(!container) return;

  // 닉네임 중복 제거: 같은 닉네임이 여러 문서로 존재할 경우 tableNumber 있는 쪽 우선, 없으면 최신
  const seenNick = {};
  const dedupedParticipants = [];
  participants.forEach(p => {
    if(p.isStaff) return;
      const key = getParticipantDedupeKey(p);
    if(seenNick[key] === undefined) {
      seenNick[key] = dedupedParticipants.length;
      dedupedParticipants.push(p);
    } else {
      const prev = dedupedParticipants[seenNick[key]];
      const prevTbl = prev.currentTable || prev.tableNumber;
      const currTbl = p.currentTable || p.tableNumber;
      if(!prevTbl && currTbl) dedupedParticipants[seenNick[key]] = p;
      else if(prevTbl && currTbl && (p.joined||0) > (prev.joined||0)) dedupedParticipants[seenNick[key]] = p;
    }
  });

  const byTable = {};
  for(let t = 1; t <= TOTAL_TABLES; t++) byTable[t] = [];
  const unassigned = [];

  dedupedParticipants.forEach(p => {
    const tNum = getParticipantCurrentTableValue(p);
    if(tNum && tNum >= 1 && tNum <= TOTAL_TABLES) byTable[tNum].push(p);
    else unassigned.push(p);
  });

  if(!isAdmin) {
    const tableNumbers = Object.keys(byTable)
      .map(Number)
      .filter(tNum => byTable[tNum].length > 0)
      .sort((a, b) => {
        const aIsMine = Number(a) === Number(myCurrentTable || tableNumber);
        const bIsMine = Number(b) === Number(myCurrentTable || tableNumber);
        if(aIsMine !== bIsMine) return aIsMine ? -1 : 1;
        return a - b;
      });

    const renderPerson = (p) => {
      const isMale = p.gender === 'male';
      const genderText = isMale ? '남성' : '여성';
      const genderClass = isMale ? 'male' : 'female';
      const displayName = getParticipantDisplayName(p);
      const avatarText = displayName.slice(0, 1);
      const real = p.realName || '이름 미입력';
      const age = p.age ? `${p.age}세` : '나이 미입력';
      const detail = isSecondPartActive ? `${genderText} · ${real} · ${age}` : `${genderText} · 이름/나이 비공개`;
      const secondBadge = p.secondParty ? '<span class="table-person-badge">2부 참여</span>' : '<span class="table-person-badge muted">2부 불참</span>';
      return `
        <div class="table-person-card ${genderClass}">
          <div class="table-person-avatar">${escapeHtml(avatarText)}</div>
          <div class="table-person-info">
            <strong>${escapeHtml(displayName)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
          ${isSecondPartActive ? secondBadge : ''}
        </div>
      `;
    };

    let participantHtml = '';
    if(tableNumbers.length === 0) {
      participantHtml = '<div class="participant-empty">표시할 테이블 참가자가 없습니다</div>';
    } else {
      participantHtml = tableNumbers.map(tNum => {
        const people = byTable[tNum].slice().sort((a, b) => {
          if(a.gender !== b.gender) return a.gender === 'female' ? -1 : 1;
          return (a.nickname || '').localeCompare(b.nickname || '', 'ko');
        });
        const maleCount = people.filter(p => p.gender === 'male').length;
        const femaleCount = people.filter(p => p.gender === 'female').length;
        const isMine = Number(tNum) === Number(myCurrentTable || tableNumber);
        return `
          <section class="table-group-card ${isMine ? 'current' : ''}">
            <div class="table-group-head">
              <div class="table-number-badge">${tNum}</div>
              <div>
                <h3>테이블 ${tNum}</h3>
                <div class="table-group-meta">
                  <span class="male">남 ${maleCount}</span>
                  <span class="female">여 ${femaleCount}</span>
                  <span>총 ${people.length}명</span>
                  ${isMine ? '<b>내 테이블</b>' : ''}
                </div>
              </div>
            </div>
            <div class="table-person-list">${people.map(renderPerson).join('')}</div>
          </section>
        `;
      }).join('');
    }

    if(unassigned.length > 0) {
      participantHtml += `
        <section class="table-group-card">
          <div class="table-group-head">
            <div class="table-number-badge muted">?</div>
            <div>
              <h3>미배정</h3>
              <div class="table-group-meta"><span>총 ${unassigned.length}명</span></div>
            </div>
          </div>
          <div class="table-person-list">${unassigned.map(renderPerson).join('')}</div>
        </section>
      `;
    }

    container.innerHTML = `<div class="participant-table-list">${participantHtml}</div>`;
    return;
  }

  function tableCell(tNum) {
    const people = byTable[tNum] || [];

    let cell = `<div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:4px 3px; min-height:44px;">`;
    cell += `<div style="text-align:center; font-size:11px; font-weight:700; color:#ffd700; margin-bottom:2px; border-bottom:1px solid rgba(255,255,255,0.07); padding-bottom:3px;">${tNum}번</div>`;

    if(people.length === 0) {
      cell += `<div style="color:#444; font-size:10px; text-align:center; margin-top:4px;">-</div>`;
    } else {
      people.forEach(p => {
        const isMale = p.gender === 'male';
        const dot = isMale
          ? `<span style="color:#64b5f6; font-size:9px; flex-shrink:0;">●남</span>`
          : `<span style="color:#f48fb1; font-size:9px; flex-shrink:0;">●여</span>`;
        const noSecondBadge = isAdmin && p.secondParty === false ? `<span style="color:#f59e0b; font-size:9px; font-weight:700; flex-shrink:0;">미</span>` : '';
        const dispNick = getParticipantDisplayName(p);
        cell += `<div style="display:flex; align-items:center; gap:2px; margin-bottom:2px; line-height:1.3;">${dot}<span style="font-size:10px; color:#e0e0e0; word-break:break-all; flex:1; min-width:0;">${dispNick}</span>${noSecondBadge}</div>`;
      });
    }
    cell += `</div>`;
    return cell;
  }

  const totalMales   = dedupedParticipants.filter(p => p.gender === 'male').length;
  const totalFemales = dedupedParticipants.filter(p => p.gender === 'female').length;
  let html = `<div style="display:flex; justify-content:center; gap:16px; margin-bottom:8px; padding:6px 10px; background:rgba(255,255,255,0.05); border-radius:8px; font-size:13px; font-weight:700;">
    <span style="color:#64b5f6;">●남 ${totalMales}명</span>
    <span style="color:rgba(255,255,255,0.3);">|</span>
    <span style="color:#f48fb1;">●여 ${totalFemales}명</span>
    <span style="color:rgba(255,255,255,0.3);">|</span>
    <span style="color:#e0e0e0;">합계 ${totalMales + totalFemales}명</span>
  </div>`;

  // 단일 CSS 그리드 — 빔프로젝터·창가는 grid-row span으로 병합
  // 가로 스크롤 래퍼: 모바일에서 잘리지 않도록 min-width 보장
  html += `<div style="overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:4px;">`;
  html += `<div style="display:grid; grid-template-columns:36px repeat(5,1fr) 34px; gap:4px; min-width:520px;">`;

  TABLE_LAYOUT.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      // 병합 셀은 아래에서 별도 렌더링
      if(cell === CELL_PROJECTOR || cell === CELL_WINDOW) return;
      // 기둥: 상단 3개(row0 col2~4)는 병합 처리, row2 col2는 단독
      if(cell === CELL_PILLAR && rowIdx === 0) return;  // 상단 3개 병합 → 아래에서 한 번에 렌더

      const pos = `grid-row:${rowIdx+1}; grid-column:${colIdx+1};`;
      if(cell === null) {
        html += `<div style="${pos} min-height:44px;"></div>`;
      } else if(cell === CELL_PILLAR) {
        // row2 단독 기둥
        html += `<div style="${pos} background:rgba(120,120,120,0.15); border:1px solid rgba(150,150,150,0.25); border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px;">
          <span style="font-size:12px;">🏛️</span>
          <span style="font-size:8px; color:#888; font-weight:600;">기둥</span>
        </div>`;
      } else if(cell === CELL_TOILET) {
        html += `<div style="${pos} background:rgba(100,181,246,0.08); border:1px solid rgba(100,181,246,0.2); border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px;">
          <span style="font-size:12px;">🚻</span>
          <span style="font-size:9px; color:#64b5f6; font-weight:600;">화장실</span>
        </div>`;
      } else if(cell === CELL_ENTRANCE) {
        html += `<div style="${pos} background:rgba(129,199,132,0.08); border:1px solid rgba(129,199,132,0.25); border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px;">
          <span style="font-size:12px;">🚪</span>
          <span style="font-size:9px; color:#81c784; font-weight:600;">입구</span>
        </div>`;
      } else if(cell === CELL_KITCHEN) {
        html += `<div style="${pos} background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.2); border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px;">
          <span style="font-size:12px;">🍳</span>
          <span style="font-size:9px; color:#fbbf24; font-weight:600;">주방</span>
        </div>`;
      } else {
        html += `<div style="${pos}">${tableCell(cell)}</div>`;
      }
    });
  });

  // 상단 기둥 3개 병합: row 1, col 3~5 (grid 1-indexed)
  html += `<div style="grid-row:1/2; grid-column:3/6; background:rgba(120,120,120,0.15); border:1px solid rgba(150,150,150,0.25); border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; flex-direction:row; gap:4px;">
    <span style="font-size:13px;">🏛️</span>
    <span style="font-size:9px; color:#999; font-weight:700; letter-spacing:0.5px;">기  둥</span>
  </div>`;

  // 빔프로젝터: col 1(index 0), row 3~5 → 3개 행 병합
  html += `<div style="grid-row:3/6; grid-column:1/2; background:rgba(220,180,255,0.07); border:1px solid rgba(220,180,255,0.3); border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
    <span style="font-size:10px; color:#dcb4ff; font-weight:700; writing-mode:vertical-lr; text-orientation:upright; letter-spacing:2px; line-height:1;">빔프로젝터</span>
  </div>`;

  // 창가: col 7(index 6), row 1~5 → 5개 행 전체 병합
  html += `<div style="grid-row:1/6; grid-column:7/8; background:rgba(147,210,255,0.06); border:1px solid rgba(147,210,255,0.2); border-radius:8px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px; padding:4px 1px;">
    <span style="font-size:14px;">🪟</span>
    <span style="font-size:8px; color:#93d2ff; font-weight:700;">창가</span>
    <div style="width:1px; height:8px; background:rgba(147,210,255,0.2);"></div>
    <svg width="28" height="52" viewBox="0 0 38 68" xmlns="http://www.w3.org/2000/svg">
      <!-- 디스펜서 본체 -->
      <rect x="4" y="2" width="30" height="38" rx="4" fill="rgba(180,210,255,0.12)" stroke="rgba(147,210,255,0.45)" stroke-width="1.5"/>
      <!-- 상단 로고 패널 -->
      <rect x="8" y="6" width="22" height="11" rx="2" fill="rgba(100,170,255,0.18)" stroke="rgba(100,180,255,0.35)" stroke-width="1"/>
      <text x="19" y="14" text-anchor="middle" font-size="5" font-weight="700" fill="#93d2ff" font-family="sans-serif">HIGHBALL</text>
      <!-- 아이스 버튼 -->
      <circle cx="13" cy="26" r="4.5" fill="rgba(150,220,255,0.2)" stroke="rgba(150,220,255,0.5)" stroke-width="1"/>
      <text x="13" y="28.5" text-anchor="middle" font-size="5" fill="#b0e0ff" font-family="sans-serif">❄</text>
      <!-- 음료 버튼 (주황/하이볼) -->
      <circle cx="25" cy="26" r="4.5" fill="rgba(255,200,80,0.2)" stroke="rgba(255,200,80,0.5)" stroke-width="1"/>
      <text x="25" y="28.5" text-anchor="middle" font-size="5.5" fill="#ffd580" font-family="sans-serif">🥃</text>
      <!-- 탭/수도꼭지 -->
      <rect x="13" y="40" width="12" height="5" rx="2" fill="rgba(180,200,230,0.3)" stroke="rgba(180,200,230,0.55)" stroke-width="1.2"/>
      <rect x="17.5" y="45" width="3" height="7" rx="1" fill="rgba(180,200,230,0.3)" stroke="rgba(180,200,230,0.55)" stroke-width="1"/>
      <!-- 물방울 -->
      <ellipse cx="19" cy="55" rx="1.5" ry="2.2" fill="rgba(147,210,255,0.6)"/>
      <ellipse cx="19" cy="59.5" rx="1" ry="1.5" fill="rgba(147,210,255,0.35)"/>
      <!-- 컵 트레이 -->
      <rect x="6" y="37" width="26" height="3" rx="1" fill="rgba(147,210,255,0.15)" stroke="rgba(147,210,255,0.3)" stroke-width="1"/>
    </svg>
    <span style="font-size:8px; color:#ffd580; font-weight:700; letter-spacing:0.5px; text-align:center; line-height:1.4;">하이볼<br>리필</span>
  </div>`;

  html += `</div></div>`;  // 그리드 닫기 + 스크롤 래퍼 닫기

  // 미배정 참여자 섹션
  if(unassigned.length > 0) {
    html += `<div style="margin-top:10px; padding:8px 10px; background:rgba(255,200,0,0.07); border:1px solid rgba(255,200,0,0.25); border-radius:8px;">`;
    html += `<div style="font-size:11px; font-weight:700; color:#ffd700; margin-bottom:6px;">🪑 미배정 (${unassigned.length}명)</div>`;
    html += `<div style="display:flex; flex-wrap:wrap; gap:4px;">`;
    unassigned.forEach(p => {
      const isMale = p.gender === 'male';
      const dotColor = isMale ? '#64b5f6' : '#f48fb1';
      const dotLabel = isMale ? '남' : '여';
      const dispNick = getParticipantDisplayName(p);
      html += `<span style="display:inline-flex; align-items:center; gap:2px; background:rgba(255,255,255,0.06); border-radius:4px; padding:2px 6px; font-size:10px;">
        <span style="color:${dotColor}; font-size:9px;">●${dotLabel}</span>
        <span style="color:#e0e0e0;">${dispNick}</span>
      </span>`;
    });
    html += `</div></div>`;
  }

  container.innerHTML = html || '<div style="color:#666; font-size:12px; text-align:center;">참가자 없음</div>';
}

function updateTableMaps() {
  const participantEl = document.getElementById('participantTableMap');
  const adminEl = document.getElementById('adminTableMap');
  renderTableMap(participantEl, tableMapParticipantsData, false);
  renderTableMap(adminEl, tableMapParticipantsData, true);
}

function listenTableMap(forceReinit = false) {
  // 이미 리스너가 활성화되어 있고 강제 재초기화가 아니면 재생성하지 않음
  // (setMyInfo 중복 호출 시 데이터 순간 공백 방지)
  if(tableMapParticipantsUnsub && !forceReinit) return;

  if(tableMapParticipantsUnsub) tableMapParticipantsUnsub();
  if(tableMapRotationUnsub) { tableMapRotationUnsub(); tableMapRotationUnsub = null; }

  const participantsQ = query(collection(db, 'participants'), where('floor', '==', 'floor2'));
  tableMapParticipantsUnsub = onSnapshot(participantsQ, snap => {
    tableMapParticipantsData = [];
    snap.forEach(d => tableMapParticipantsData.push({ id: d.id, ...d.data() }));
    updateTableMaps();
  }, err => {
    console.error('[TableMap] 스냅샷 오류:', err);
    // 오류 시 5초 후 재연결
    setTimeout(() => { tableMapParticipantsUnsub = null; listenTableMap(); }, 5000);
  });
}

// ─────────────────────────────────────────────────────────────
// 자리 배치 — admin side
// ─────────────────────────────────────────────────────────────
let tableRotationAdminUnsub = null;

function listenTableRotationAdmin() {
  if(tableRotationAdminUnsub) tableRotationAdminUnsub();

  tableRotationAdminUnsub = onSnapshot(doc(db, 'settings', TABLE_ROTATION_DOC), (snap) => {
    const moveStatusEl = document.getElementById('rotationMoveStatus');
    const lastTableInput = document.getElementById('lastTableInput');
    if(!snap.exists()) {
      if(moveStatusEl) moveStatusEl.style.display = 'none';
      return;
    }
    const data = snap.data();
    const round = data.round || 0;
    if(moveStatusEl && round > 0) {
      moveStatusEl.style.display = 'block';
      moveStatusEl.style.background = 'rgba(16,185,129,0.16)';
      moveStatusEl.style.color = '#10b981';
      moveStatusEl.textContent = `✅ ${round}R 완료`;
    }
    if(lastTableInput && data.manualLastTable) {
      lastTableInput.value = data.manualLastTable;
    }
  });

  const computeBtn = document.getElementById('computeRotationBtn');
  if(computeBtn) computeBtn.onclick = () => computeTableRotation();

  const saveLastTableBtn = document.getElementById('saveLastTableBtn');
  const lastTableInput = document.getElementById('lastTableInput');
  const lastTableSavedMsg = document.getElementById('lastTableSavedMsg');
  if(saveLastTableBtn && lastTableInput) {
    saveLastTableBtn.onclick = async () => {
      const val = parseInt(lastTableInput.value, 10);
      if(!val || val < 1 || val > TOTAL_TABLES) {
        alert(`1 ~ ${TOTAL_TABLES} 사이의 숫자를 입력하세요.`);
        return;
      }
      await setDoc(doc(db, 'settings', TABLE_ROTATION_DOC), { manualLastTable: val }, { merge: true });
      if(lastTableSavedMsg) {
        lastTableSavedMsg.style.display = 'inline';
        setTimeout(() => { lastTableSavedMsg.style.display = 'none'; }, 2000);
      }
    };
  }

}


let computeRotationBusy = false; // 중복 실행 방지

async function computeTableRotation() {
  if(computeRotationBusy) return; // 이미 실행 중이면 무시
  computeRotationBusy = true;

  const moveStatusEl = document.getElementById('rotationMoveStatus');
  const computeBtn = document.getElementById('computeRotationBtn');
  if(computeBtn) { computeBtn.disabled = true; computeBtn.textContent = '이동 중...'; }

  function showRotationStatus(msg, color = '#ffc107', bg = 'rgba(255,193,7,0.2)') {
    if(!moveStatusEl) return;
    moveStatusEl.style.display = 'block';
    moveStatusEl.style.background = bg;
    moveStatusEl.style.color = color;
    moveStatusEl.textContent = msg;
  }

  try {
  const settingsRef = doc(db, 'settings', TABLE_ROTATION_DOC);
  const lockStartedAt = Date.now();
  const { currentRound, manualLastTable } = await runTransaction(db, async transaction => {
    const settingsSnap = await transaction.get(settingsRef);
    const existingData = settingsSnap.exists() ? settingsSnap.data() : {};
    if(existingData.rotationLockUntil && existingData.rotationLockUntil > lockStartedAt) {
      throw new Error('ROTATION_LOCKED');
    }
    transaction.set(settingsRef, {
      rotationLockUntil: lockStartedAt + 8000,
      lockStartedAt
    }, { merge: true });
    return { currentRound: existingData.round || 0, manualLastTable: existingData.manualLastTable || null };
  });

  await cleanupDuplicateParticipantsForFloor('floor2');

  const snap = await getDocs(query(
    collection(db, 'participants'),
    where('floor', '==', 'floor2')
  ));
  const participants = [];
  const seen = {};
  snap.forEach(d => {
    const p = { id: d.id, ref: d.ref, ...d.data() };
    if(p.isStaff) return;
    const key = getParticipantDedupeKey(p);
    if(!seen[key]) {
      seen[key] = p;
      return;
    }
    if(isBetterParticipantRecord(p, seen[key])) {
      seen[key] = p;
    }
  });
  Object.values(seen).forEach(p => participants.push(p));

  const males = participants.filter(p => p.gender === 'male' && getParticipantCurrentTableValue(p));

  if(males.length === 0) {
    showRotationStatus('⚠️ 이동할 남자 참가자가 없습니다', '#f87171', 'rgba(239,68,68,0.15)');
    await setDoc(settingsRef, { rotationLockUntil: Date.now() + 1000 }, { merge: true });
    computeRotationBusy = false;
    if(computeBtn) { computeBtn.disabled = false; computeBtn.textContent = '남자 한 칸 이동'; }
    return;
  }

  // 관리자가 설정한 마지막 테이블 우선, 없으면 남성 참가자 기준 자동 계산
  const lastTable = manualLastTable
    ? manualLastTable
    : Math.max(...males.map(m => getParticipantCurrentTableValue(m)).filter(Boolean));

  if(!lastTable) {
    showRotationStatus('⚠️ 마지막 테이블 번호를 먼저 설정해주세요', '#f87171', 'rgba(239,68,68,0.15)');
    await setDoc(settingsRef, { rotationLockUntil: Date.now() + 1000 }, { merge: true });
    computeRotationBusy = false;
    if(computeBtn) { computeBtn.disabled = false; computeBtn.textContent = '남자 한 칸 이동'; }
    return;
  }

  const newRound = currentRound + 1;

  const assignments = {};
  males.forEach(m => {
    const currentTable = getParticipantCurrentTableValue(m);
    assignments[m.id] = currentTable >= lastTable ? 1 : currentTable + 1;
  });

  const batch = writeBatch(db);
  males.forEach(m => {
    if(!m.id || !assignments[m.id]) return;
    batch.set(doc(db, 'participants', m.id), { currentTable: assignments[m.id] }, { merge: true });
  });
  await batch.commit();

  await setDoc(settingsRef, {
    round: newRound,
    active: false,
    lastTable,
    manualLastTable: manualLastTable || lastTable,
    movedCount: males.length,
    assignments,
    updatedAt: Date.now(),
    rotationLockUntil: Date.now() + 1000
  });

  if(computeBtn) { computeBtn.disabled = false; computeBtn.textContent = '남자 한 칸 이동'; }
  showRotationStatus(`✅ ${newRound}R 완료`, '#10b981', 'rgba(16,185,129,0.16)');
  } catch(e) {
    console.error('자리배치 오류 상세:', e);
    if(e.message === 'ROTATION_LOCKED') {
      showRotationStatus('⚠️ 방금 로테이션이 실행됐습니다. 잠시 후 다시 눌러주세요.', '#f59e0b', 'rgba(245,158,11,0.16)');
    } else {
      showRotationStatus('⚠️ 자리배치 오류: ' + (e.message || String(e)), '#f87171', 'rgba(239,68,68,0.15)');
    }
    if(computeBtn) { computeBtn.disabled = false; computeBtn.textContent = '남자 한 칸 이동'; }
  } finally {
    computeRotationBusy = false;
  }
}

// ─────────────────────────────────────────────────────────────
// 시그널 투표 (썸 레이더)
// ─────────────────────────────────────────────────────────────
const SIGNAL_VOTE_DOC = 'signalVote';
const SIGNAL_DURATION = 180; // 3분
let signalVoteQ1 = null;
let signalVoteQ2 = null;
let signalVoteSubmitted = false;
let signalVoteUnsub = null;
let signalVoteAdminUnsub = null;
let signalCountdownInterval = null;
let signalAdminCountdownInterval = null;

function fmtSignalTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ── 칩 렌더 ──
function renderSignalChips(listEl, countEl, selectedRef, onSelect) {
  listEl.innerHTML = '';
  const opposites = allOppositeParticipants.map(p => p.data.nickname).filter(n => n && n !== nickname);
  if(opposites.length === 0) {
    listEl.innerHTML = '<span style="font-size:13px; color:rgba(255,255,255,0.4);">아직 참가자가 없습니다</span>';
    return;
  }
  opposites.forEach(name => {
    const chip = document.createElement('div');
    chip.textContent = name;
    const sel = selectedRef() === name;
    chip.style.cssText = `padding:7px 14px; border-radius:20px; font-size:13px; font-weight:600; cursor:pointer;
      border:2px solid ${sel ? '#ff6eb4' : 'rgba(255,255,255,0.2)'};
      background:${sel ? 'linear-gradient(135deg,rgba(255,110,180,0.4),rgba(192,132,252,0.3))' : 'rgba(255,255,255,0.07)'};
      color:${sel ? '#fff' : 'rgba(255,255,255,0.75)'};
      transition:all 0.15s; box-shadow:${sel ? '0 0 12px rgba(255,110,180,0.4)' : 'none'};`;
    chip.addEventListener('click', () => {
      if(signalVoteSubmitted) return;
      onSelect(selectedRef() === name ? null : name);
      if(countEl) { countEl.textContent = selectedRef() ? '1/1' : '0/1'; countEl.style.color = selectedRef() ? '#ff6eb4' : 'rgba(255,255,255,0.5)'; }
      renderSignalChips(listEl, countEl, selectedRef, onSelect);
    });
    listEl.appendChild(chip);
  });
}

function refreshSignalLists() {
  const q1List = document.getElementById('signalQ1List');
  const q1Count = document.getElementById('signalQ1Count');
  const q2List = document.getElementById('signalQ2List');
  const q2Count = document.getElementById('signalQ2Count');
  if(!q1List) return;
  renderSignalChips(q1List, q1Count, () => signalVoteQ1, v => { signalVoteQ1 = v; });
  renderSignalChips(q2List, q2Count, () => signalVoteQ2, v => { signalVoteQ2 = v; });
}

// ── 참가자: 카운트다운 타이머 ──
function startSignalParticipantCountdown(startedAt, duration) {
  if(signalCountdownInterval) { clearInterval(signalCountdownInterval); signalCountdownInterval = null; }
  const timerBar = document.getElementById('signalVoteTimerBar');
  const countdownEl = document.getElementById('signalVoteCountdown');
  if(!timerBar || !countdownEl) return;
  timerBar.style.display = 'flex';

  function tick() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    countdownEl.textContent = fmtSignalTime(remaining);
    countdownEl.style.color = remaining <= 30 ? '#f87171' : '#ff6eb4';
    if(remaining <= 0) { clearInterval(signalCountdownInterval); signalCountdownInterval = null; timerBar.style.display = 'none'; }
  }
  tick();
  signalCountdownInterval = setInterval(tick, 1000);
}

// ── 참가자: 내 결과 표시 ──
async function showMySignalResult() {
  const panel = document.getElementById('signalResultPanel');
  const votePanel = document.getElementById('signalVotePanel');
  const timerBar = document.getElementById('signalVoteTimerBar');
  if(!panel) return;

  // 투표 패널 숨기고 결과 패널 표시
  if(votePanel) votePanel.style.display = 'none';
  if(timerBar) timerBar.style.display = 'none';
  panel.style.display = 'block';

  const laughEl = document.getElementById('mySignalLaughResult');
  const heartEl = document.getElementById('mySignalHeartResult');
  if(!laughEl || !heartEl) return;

  // 나를 선택한 사람 조회
  const snap = await getDocs(query(
    collection(db, 'signalVotes'),
    where('floor', '==', floor)
  ));

  const laughVoters = [], heartVoters = [];
  snap.forEach(d => {
    const v = d.data();
    if(v.laugh === nickname) laughVoters.push(v.voterNickname);
    if(v.heart === nickname) heartVoters.push(v.voterNickname);
  });

  const renderNames = (names, emptyMsg) => {
    if(names.length === 0) return `<span style="color:rgba(255,255,255,0.35); font-size:13px;">${emptyMsg}</span>`;
    return names.map(n =>
      `<span style="display:inline-block; background:linear-gradient(135deg,rgba(255,110,180,0.25),rgba(192,132,252,0.2)); border:1px solid rgba(255,110,180,0.4); border-radius:20px; padding:5px 14px; margin:3px; font-size:13px; font-weight:600;">${n}</span>`
    ).join('');
  };

  laughEl.innerHTML = renderNames(laughVoters, '아직 아무도 선택하지 않았어요 😊');
  heartEl.innerHTML = renderNames(heartVoters, '아직 아무도 선택하지 않았어요 💭');
}

// ── 참가자: 리스너 ──
function listenSignalVote() {
  if(signalVoteUnsub) signalVoteUnsub();
  const section = document.getElementById('signalVoteSection');
  if(!section) return;

  signalVoteUnsub = onSnapshot(doc(db, 'settings', SIGNAL_VOTE_DOC), async (snap) => {
    const votePanel = document.getElementById('signalVotePanel');
    const resultPanel = document.getElementById('signalResultPanel');
    const timerBar = document.getElementById('signalVoteTimerBar');

    if(!snap.exists()) { section.classList.add('hidden'); return; }
    const data = snap.data();
    const { active, revealed, startedAt, duration } = data;

    // 결과 공개 상태
    if(revealed) {
      section.classList.remove('hidden');
      if(votePanel) votePanel.style.display = 'none';
      if(timerBar) timerBar.style.display = 'none';
      if(signalCountdownInterval) { clearInterval(signalCountdownInterval); signalCountdownInterval = null; }
      showMySignalResult();
      return;
    }

    // 투표 진행중
    if(active) {
      section.classList.remove('hidden');
      if(votePanel) votePanel.style.display = 'block';
      if(resultPanel) resultPanel.style.display = 'none';
      if(startedAt && duration) startSignalParticipantCountdown(startedAt, duration);

      // 이미 제출 확인
      if(!signalVoteSubmitted) {
        const myVoteSnap = await getDocs(query(
          collection(db, 'signalVotes'),
          where('voterNickname', '==', nickname),
          where('floor', '==', floor)
        ));
        if(!myVoteSnap.empty) {
          signalVoteSubmitted = true;
          const badge = document.getElementById('signalVoteSubmittedBadge');
          if(badge) badge.style.display = 'block';
          const btn = document.getElementById('submitSignalVoteBtn');
          if(btn) { btn.textContent = '✓ 시그널 전송 완료'; btn.style.opacity = '0.5'; btn.disabled = true; }
          const v = myVoteSnap.docs[0].data();
          signalVoteQ1 = v.laugh || null;
          signalVoteQ2 = v.heart || null;
        }
      }
      refreshSignalLists();
      return;
    }

    // 비활성 (시작 전)
    section.classList.add('hidden');
    if(signalCountdownInterval) { clearInterval(signalCountdownInterval); signalCountdownInterval = null; }
  });

  const btn = document.getElementById('submitSignalVoteBtn');
  if(btn) btn.onclick = submitSignalVote;
}

async function submitSignalVote() {
  if(signalVoteSubmitted) return;
  if(!signalVoteQ1 && !signalVoteQ2) {
    const btn = document.getElementById('submitSignalVoteBtn');
    if(btn) { btn.textContent = '❗ 최소 1명은 선택해주세요'; setTimeout(() => { btn.textContent = '💫 시그널 보내기'; }, 1500); }
    return;
  }
  try {
    await addDoc(collection(db, 'signalVotes'), {
      voterNickname: nickname, voterGender: gender, floor,
      laugh: signalVoteQ1 || null, heart: signalVoteQ2 || null,
      timestamp: Date.now()
    });
    signalVoteSubmitted = true;
    const badge = document.getElementById('signalVoteSubmittedBadge');
    if(badge) badge.style.display = 'block';
    const btn = document.getElementById('submitSignalVoteBtn');
    if(btn) { btn.textContent = '✓ 시그널 전송 완료'; btn.style.opacity = '0.5'; btn.disabled = true; }
    refreshSignalLists();
  } catch(e) { console.error('시그널 투표 오류:', e); }
}

// ── 관리자: 시작/결과공개 ──
async function startSignalVote() {
  const now = Date.now();
  await setDoc(doc(db, 'settings', SIGNAL_VOTE_DOC), {
    active: true, revealed: false, startedAt: now, duration: SIGNAL_DURATION
  });
}

async function stopSignalVote() {
  const snap = await getDoc(doc(db, 'settings', SIGNAL_VOTE_DOC));
  const base = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, 'settings', SIGNAL_VOTE_DOC), { ...base, active: false, revealed: false });
}

async function resetSignalVote() {
  if(!confirm('썸 레이더 투표 데이터를 전부 초기화하시겠습니까?\n(모든 투표 기록이 삭제됩니다)')) return;
  try {
    // settings 초기화
    await deleteDoc(doc(db, 'settings', SIGNAL_VOTE_DOC));
    // 이 층 signalVotes 전체 삭제
    const votesSnap = await getDocs(query(
      collection(db, 'signalVotes'),
      where('floor', '==', adminFloor)
    ));
    const batch = writeBatch(db);
    votesSnap.forEach(d => batch.delete(doc(db, 'signalVotes', d.id)));
    await batch.commit();
    const statusEl = document.getElementById('signalVoteAdminStatus');
    if(statusEl) { statusEl.textContent = '✅ 초기화 완료'; statusEl.style.color = '#10b981'; setTimeout(() => { statusEl.textContent = '대기중'; statusEl.style.color = 'rgba(255,255,255,0.5)'; }, 2000); }
  } catch(e) { console.error('초기화 오류:', e); }
}

async function revealSignalVote() {
  const snap = await getDoc(doc(db, 'settings', SIGNAL_VOTE_DOC));
  const base = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, 'settings', SIGNAL_VOTE_DOC), { ...base, active: false, revealed: true });
}

// ── 관리자: 카운트다운 타이머 ──
function startSignalAdminCountdown(startedAt, duration) {
  if(signalAdminCountdownInterval) { clearInterval(signalAdminCountdownInterval); signalAdminCountdownInterval = null; }
  const cdEl = document.getElementById('signalVoteAdminCountdown');
  if(!cdEl) return;
  cdEl.style.display = 'block';

  function tick() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    cdEl.textContent = fmtSignalTime(remaining);
    cdEl.style.color = remaining <= 30 ? '#f87171' : '#ff6eb4';
    if(remaining <= 0) {
      clearInterval(signalAdminCountdownInterval); signalAdminCountdownInterval = null;
      cdEl.style.display = 'none';
    }
  }
  tick();
  signalAdminCountdownInterval = setInterval(tick, 1000);
}

function listenSignalVoteAdmin() {
  const startBtn = document.getElementById('startSignalVoteBtn');
  const stopBtn = document.getElementById('stopSignalVoteBtn');
  const revealBtn = document.getElementById('revealSignalVoteBtn');
  const resetBtn = document.getElementById('resetSignalVoteBtn');
  if(startBtn) startBtn.onclick = startSignalVote;
  if(stopBtn) stopBtn.onclick = stopSignalVote;
  if(revealBtn) revealBtn.onclick = revealSignalVote;
  if(resetBtn) resetBtn.onclick = resetSignalVote;

  // settings 실시간 반영 + 카운트다운
  onSnapshot(doc(db, 'settings', SIGNAL_VOTE_DOC), (snap) => {
    const statusEl = document.getElementById('signalVoteAdminStatus');
    const cdEl = document.getElementById('signalVoteAdminCountdown');
    if(!snap.exists()) {
      if(statusEl) { statusEl.textContent = '대기중'; statusEl.style.color = 'rgba(255,255,255,0.5)'; }
      if(cdEl) cdEl.style.display = 'none';
      if(signalAdminCountdownInterval) { clearInterval(signalAdminCountdownInterval); signalAdminCountdownInterval = null; }
      return;
    }
    const { active, revealed, startedAt, duration } = snap.data();
    if(active) {
      if(statusEl) { statusEl.textContent = '⏱ 투표 진행중'; statusEl.style.color = '#ff6eb4'; }
      if(startedAt && duration) startSignalAdminCountdown(startedAt, duration);
    } else if(revealed) {
      if(statusEl) { statusEl.textContent = '📊 결과 공개됨'; statusEl.style.color = '#c084fc'; }
      if(cdEl) cdEl.style.display = 'none';
      if(signalAdminCountdownInterval) { clearInterval(signalAdminCountdownInterval); signalAdminCountdownInterval = null; }
    } else {
      if(statusEl) { statusEl.textContent = '대기중'; statusEl.style.color = 'rgba(255,255,255,0.5)'; }
      if(cdEl) cdEl.style.display = 'none';
      if(signalAdminCountdownInterval) { clearInterval(signalAdminCountdownInterval); signalAdminCountdownInterval = null; }
    }
  });

  // 투표 결과 실시간 집계
  if(signalVoteAdminUnsub) signalVoteAdminUnsub();
  signalVoteAdminUnsub = onSnapshot(
    query(collection(db, 'signalVotes'), where('floor', '==', adminFloor)),
    (snap) => {
      const resultsEl = document.getElementById('signalVoteResults');
      const laughEl = document.getElementById('signalResultLaugh');
      const heartEl = document.getElementById('signalResultHeart');
      if(!resultsEl || !laughEl || !heartEl) return;
      if(snap.empty) { resultsEl.style.display = 'none'; return; }
      resultsEl.style.display = 'block';

      const laughCount = {}, heartCount = {};
      snap.forEach(d => {
        const v = d.data();
        if(v.laugh) laughCount[v.laugh] = (laughCount[v.laugh] || 0) + 1;
        if(v.heart) heartCount[v.heart] = (heartCount[v.heart] || 0) + 1;
      });
      const fmt = (obj) => {
        const sorted = Object.entries(obj).sort((a,b) => b[1]-a[1]);
        if(!sorted.length) return '<span style="color:rgba(255,255,255,0.35)">아직 없음</span>';
        return sorted.map(([name, cnt]) =>
          `<span style="display:inline-block; background:rgba(255,110,180,0.15); border:1px solid rgba(255,110,180,0.3); border-radius:8px; padding:3px 10px; margin:2px; font-size:13px;">${name} <strong style="color:#ff6eb4;">${cnt}표</strong></span>`
        ).join('');
      };
      laughEl.innerHTML = fmt(laughCount);
      heartEl.innerHTML = fmt(heartCount);
    }
  );
}

async function resetTableRotation() {
  if(!confirm('자리 배치 데이터를 초기화하시겠습니까?')) return;
  await deleteDoc(doc(db, 'settings', TABLE_ROTATION_DOC));

  // 남자 participant 문서에서 currentTable 필드 제거 (참가자 필터 원위치)
  try {
    const maleSnap = await getDocs(query(
      collection(db, 'participants'),
      where('gender','==','male'),
      where('floor','==',adminFloor)
    ));
    const resetBatch = writeBatch(db);
    maleSnap.forEach(d => {
      resetBatch.update(doc(db, 'participants', d.id), { currentTable: deleteField() });
    });
    await resetBatch.commit();
  } catch(e) { console.error('currentTable 초기화 오류:', e); }
}


// ─────────────────────────────────────────────
// 1부 게임 (이미지 게임 + 밸런스 게임)
// ─────────────────────────────────────────────
const IMAGE_GAME_DOC = 'imageGame';
const BALANCE_GAME_DOC = 'balanceGame';

// ── 날짜 기반 랜덤 시드 셔플 ──────────────────────────────
function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const IMAGE_GAME_QUESTIONS_ALL = [
  { q: '여기서 볼수록 매력 있을 것 같은 사람은?', penalty: '이상형에 가장 가까운 이성에게 "오늘 진짜 분위기 있어요" 말하기 💫' },
  { q: '첫 데이트 분위기 제일 잘 낼 것 같은 사람은?', penalty: '오늘 제일 눈에 들어온 이성에게 직접 한 마디 칭찬하기 💕' },
  { q: '사귀면 제일 잘 챙겨줄 것 같은 사람은?', penalty: '이성 중 한 명 골라 눈 마주치고 미소 지어주기 😊' },
  { q: '제일 고백받을 것 같은 사람은?', penalty: '본인 이상형 솔직하게 공개하기 💌' },
  { q: '오늘 제일 설레게 할 것 같은 사람은?', penalty: '이상형에 가장 가까운 이성과 짠 🥂' },
  { q: '제일 질투심 많을 것 같은 사람은?', penalty: '본인 매력 포인트 세 가지 말하기 ✨' },
  { q: '제일 밀당 잘할 것 같은 사람은?', penalty: '그나마 이상형에 두 번째로 가까운 이성이랑 짠 🥂' },
  { q: '야식 같이 먹고 싶은 사람은?', penalty: '성격이 제일 잘 맞을 것 같은 이성이랑 짠 🥂' },
  { q: '제일 연락 자주 올 것 같은 사람은?', penalty: '동성 한 명 골라서 러브샷 🍾' },
  { q: '드라이브 같이 가고 싶은 사람은?', penalty: '제일 웃기게 생긴 이성에게 "오늘 제일 예뻐 보여요/잘생겨 보여요" 말하기 😄' },
  { q: '제일 연예인 닮은 사람은?', penalty: '다 같이 짠 🥂' },
  { q: '연애하면 제일 다정할 것 같은 사람은?', penalty: '본인 잔 절반 이상 마시기 🥃' },
  { q: '제일 귀여운 척 잘할 것 같은 사람은?', penalty: '동성 아무나 한 명이랑 짠 🥂' },
  { q: '제일 스킨십 좋아할 것 같은 사람은?', penalty: '이성 중 제일 매력적인 사람에게 "오늘 여기서 제일 빛나요" 말하기 🌟' },
  { q: '여기서 제일 사랑 많이 줄 것 같은 사람은?', penalty: '지목받은 사람과 건배하고 눈 맞추기 🥂👀' },
  { q: '제일 연애 많이 해봤을 것 같은 사람은?', penalty: '본인 장점 두 가지 말하기 🗣️' },
  { q: '제일 공부 잘했을 것 같은 사람은?', penalty: '이상형이랑 가장 먼 이성이랑 짠 🥂' },
  { q: '제일 게을러 보이는 사람은?', penalty: '본인 잔 절반 이상 마시기 🥃' },
  { q: '제일 깔끔할 것 같은 사람은?', penalty: '성격이 제일 안 맞을 것 같은 이성이랑 짠 🥂' },
  { q: '제일 집에 일찍 갈 것 같은 사람은?', penalty: '제일 전애인과 닮은 이성과 짠 🥂' },
  { q: '제일 술 잘 마실 것 같은 사람은?', penalty: '성격이 제일 안 맞을 것 같은 이성이랑 짠 🥂' },
  { q: '제일 인스타 감성 사진 잘 찍을 것 같은 사람은?', penalty: '성격이 제일 잘 맞을 것 같은 이성이랑 짠 🥂' },
  { q: '제일 이별 잘 못할 것 같은 사람은?', penalty: '본인 장점 두 가지 말하기 🗣️' },
  { q: '제일 혼자 여행 잘 다닐 것 같은 사람은?', penalty: '이상형이랑 가장 먼 이성이랑 짠 🥂' },
  { q: '제일 쇼핑 많이 할 것 같은 사람은?', penalty: '본인 잔 절반 이상 마시기 🥃' },
  { q: '제일 연애하면 집착할 것 같은 사람은?', penalty: '그나마 이상형에 2번째로 가까운 이성이랑 짠 🥂' },
  { q: '제일 첫사랑 오래 못 잊을 것 같은 사람은?', penalty: '성격이 제일 안 맞을 것 같은 이성이랑 짠 🥂' },
  { q: '제일 고백 잘할 것 같은 사람은?', penalty: '성격이 제일 잘 맞을 것 같은 이성이랑 짠 🥂' },
  { q: '몇 년 뒤에 결혼할 것 같은 사람은?', penalty: '이성 한 명 골라서 오늘 인상 솔직하게 말해주기 💬' },
  { q: '제일 든든할 것 같은 사람은?', penalty: '지목한 이성에게 "오늘 분위기 최고예요" 말하기 🌹' },
];

const BALANCE_GAME_QUESTIONS_ALL = [
  { a: '사랑한다 자주 말하기', b: '말 대신 행동으로만 보여주기' },
  { a: '애교 넘치는 연인', b: '차분한 차도남/차도녀' },
  { a: '매일 연락하는 연애', b: '필요할 때만 연락하는 연애' },
  { a: '첫 만남에 바로 고백', b: '썸 오래 타기' },
  { a: '완벽한 외모', b: '완벽한 성격' },
  { a: '연애 초반 설레임', b: '오래된 편안한 안정감' },
  { a: '같이 있으면 신나는 사람', b: '같이 있으면 편안한 사람' },
  { a: '내가 먼저 고백하기', b: '상대가 고백해줄 때까지 기다리기' },
  { a: '다정한 스킨십', b: '눈빛만으로 통하는 교감' },
  { a: '솔직하게 다 말하는 연인', b: '적당히 비밀 있는 연인' },
  { a: '연인이랑 24시간 붙어있기', b: '하루 2시간만 딱 만나기' },
  { a: '카페 데이트', b: '드라이브 데이트' },
  { a: '고백 문자', b: '고백 직접 만나서' },
  { a: '잘 웃는 연인', b: '잘 들어주는 연인' },
  { a: '손 잡기', b: '어깨 기대기' },
  { a: '첫 데이트 영화관', b: '첫 데이트 맛집' },
  { a: '연인이 먼저 잘 자 연락', b: '내가 먼저 잘 자 연락' },
  { a: '설레는 연애 vs 편한 연애', b: '편안하고 따뜻한 연애' },
  { a: '자주 만나는 연애', b: '보고 싶을 때만 만나는 연애' },
  { a: '투명하게 모든 걸 공유하는 연인', b: '서로 개인 공간 존중하는 연인' },
  { a: '짧고 강렬하게 사랑하기', b: '오래오래 함께하기' },
  { a: '연인이 나만 봐주기', b: '연인이 친구도 잘 챙기기' },
  { a: '기념일 꼭 챙기기', b: '기념일 없어도 매일이 특별하기' },
  { a: '연락은 자주, 만남은 가끔', b: '연락은 가끔, 만남은 자주' },
  { a: '질투심 있는 연인', b: '완전 자유로운 연인' },
  { a: '함께 도전하는 연애', b: '함께 쉬어가는 연애' },
];

// 매일 다른 순서로 셔플
const _dailySeed = getDailySeed();
const IMAGE_GAME_QUESTIONS = seededShuffle(IMAGE_GAME_QUESTIONS_ALL, _dailySeed);
const BALANCE_GAME_QUESTIONS = seededShuffle(BALANCE_GAME_QUESTIONS_ALL, _dailySeed + 1);

let imageGameUnsub = null;
let balanceGameUnsub = null;

// ── 참여자: 이미지 게임 리스너 ──
function applyImageGameSnap(snap) {
  try {
    const section = document.getElementById('imageGameSection');
    if(!section) return;
    section.classList.remove('hidden');
    const { questionIdx = 0 } = snap && snap.exists() ? snap.data() : {};
    const safeIdx = Math.max(0, questionIdx) % (IMAGE_GAME_QUESTIONS.length || 1);
    const qData = IMAGE_GAME_QUESTIONS[safeIdx];
    if(!qData) return;
    const qEl = document.getElementById('imageGameQuestion');
    const penaltyEl = document.getElementById('imageGamePenalty');
    const penaltyBtn = document.getElementById('imageGamePenaltyBtn');
    if(qEl) qEl.textContent = qData.q;
    if(penaltyEl) {
      penaltyEl.style.display = 'none';
      penaltyEl.textContent = '🔥 벌칙: ' + qData.penalty;
    }
    if(penaltyBtn) {
      penaltyBtn.onclick = () => {
        if(!penaltyEl) return;
        penaltyEl.style.display = penaltyEl.style.display === 'none' ? 'block' : 'none';
      };
    }
  } catch(e) {
    console.error('이미지게임 표시 오류:', e);
  }
}

function listenImageGame() {
  if(imageGameUnsub) imageGameUnsub();
  const section = document.getElementById('imageGameSection');
  if(!section) return;
  // 즉시 현재 상태 읽기 (네트워크 지연으로 snapshot 늦게 올 경우 대비)
  getDoc(doc(db, 'settings', IMAGE_GAME_DOC)).then(applyImageGameSnap).catch(() => {});
  // 실시간 변경 감지
  imageGameUnsub = onSnapshot(doc(db, 'settings', IMAGE_GAME_DOC),
    applyImageGameSnap,
    (err) => {
      // 리스너 오류 시 5초 후 재연결
      console.warn('이미지게임 리스너 오류, 재연결 중...', err);
      setTimeout(() => listenImageGame(), 5000);
    }
  );
}

// ── 참여자: 밸런스 게임 리스너 ──
function applyBalanceGameSnap(snap) {
  try {
    const section = document.getElementById('balanceGameSection');
    if(!section) return;
    section.classList.remove('hidden');
    const { questionIdx = 0 } = snap && snap.exists() ? snap.data() : {};
    const safeIdx = Math.max(0, questionIdx) % (BALANCE_GAME_QUESTIONS.length || 1);
    const qData = BALANCE_GAME_QUESTIONS[safeIdx];
    if(!qData) return;
    const aEl = document.getElementById('balanceGameA');
    const bEl = document.getElementById('balanceGameB');
    if(aEl) aEl.textContent = qData.a;
    if(bEl) bEl.textContent = qData.b;
  } catch(e) {
    console.error('밸런스게임 표시 오류:', e);
  }
}

function listenBalanceGame() {
  if(balanceGameUnsub) balanceGameUnsub();
  const section = document.getElementById('balanceGameSection');
  if(!section) return;
  // 즉시 현재 상태 읽기 (네트워크 지연으로 snapshot 늦게 올 경우 대비)
  getDoc(doc(db, 'settings', BALANCE_GAME_DOC)).then(applyBalanceGameSnap).catch(() => {});
  // 실시간 변경 감지
  balanceGameUnsub = onSnapshot(doc(db, 'settings', BALANCE_GAME_DOC),
    applyBalanceGameSnap,
    (err) => {
      // 리스너 오류 시 5초 후 재연결
      console.warn('밸런스게임 리스너 오류, 재연결 중...', err);
      setTimeout(() => listenBalanceGame(), 5000);
    }
  );
}

// ── 관리자: 이미지 게임 ──
async function startImageGame() {
  await setDoc(doc(db, 'settings', IMAGE_GAME_DOC), { questionIdx: 0 });
}
async function stopImageGame() {
  await setDoc(doc(db, 'settings', IMAGE_GAME_DOC), { questionIdx: 0 });
}
async function nextImageQuestion() {
  const snap = await getDoc(doc(db, 'settings', IMAGE_GAME_DOC));
  const cur = snap.exists() ? (snap.data().questionIdx || 0) : 0;
  await setDoc(doc(db, 'settings', IMAGE_GAME_DOC), { questionIdx: cur + 1 });
}

// ── 관리자: 밸런스 게임 ──
async function startBalanceGame() {
  await setDoc(doc(db, 'settings', BALANCE_GAME_DOC), { questionIdx: 0 });
}
async function stopBalanceGame() {
  await setDoc(doc(db, 'settings', BALANCE_GAME_DOC), { questionIdx: 0 });
}
async function nextBalanceQuestion() {
  const snap = await getDoc(doc(db, 'settings', BALANCE_GAME_DOC));
  const cur = snap.exists() ? (snap.data().questionIdx || 0) : 0;
  await setDoc(doc(db, 'settings', BALANCE_GAME_DOC), { questionIdx: cur + 1 });
}

// ── 관리자: 게임 버튼 연결 + 상태 표시 ──
function listenGamesAdmin() {
  const startImg = document.getElementById('startImageGameBtn');
  const stopImg = document.getElementById('stopImageGameBtn');
  const nextImg = document.getElementById('nextImageQuestionBtn');
  if(startImg) startImg.style.display = 'none';
  if(stopImg) stopImg.style.display = 'none';
  if(nextImg) nextImg.onclick = nextImageQuestion;

  const startBal = document.getElementById('startBalanceGameBtn');
  const stopBal = document.getElementById('stopBalanceGameBtn');
  const nextBal = document.getElementById('nextBalanceQuestionBtn');
  if(startBal) startBal.style.display = 'none';
  if(stopBal) stopBal.style.display = 'none';
  if(nextBal) nextBal.onclick = nextBalanceQuestion;

  onSnapshot(doc(db, 'settings', IMAGE_GAME_DOC), (snap) => {
    const el = document.getElementById('imageGameAdminStatus');
    if(!el) return;
    const idx = snap.exists() ? (snap.data().questionIdx || 0) : 0;
    const qData = IMAGE_GAME_QUESTIONS[idx % IMAGE_GAME_QUESTIONS.length];
    el.textContent = `🎯 ${idx + 1}번째: ${qData.q}`;
    el.style.color = '#fb923c';
  });

  onSnapshot(doc(db, 'settings', BALANCE_GAME_DOC), (snap) => {
    const el = document.getElementById('balanceGameAdminStatus');
    if(!el) return;
    const idx = snap.exists() ? (snap.data().questionIdx || 0) : 0;
    const qData = BALANCE_GAME_QUESTIONS[idx % BALANCE_GAME_QUESTIONS.length];
    el.textContent = `⚖️ ${idx + 1}번째: ${qData.a} vs ${qData.b}`;
    el.style.color = '#a78bfa';
  });
}

function listenParty2Admin() {
  const statusEl = document.getElementById('party2AdminStatus');
  const party2Ref = doc(db, 'settings', 'party2');
  onSnapshot(party2Ref, snap => {
    const started = snap.exists() && snap.data().started === true;
    if(statusEl) {
      statusEl.textContent = started ? '🎊 2부 진행중' : '⏸ 2부 시작 전';
      statusEl.style.color = started ? '#10b981' : 'rgba(255,255,255,0.6)';
    }
  });
}
