export const pages = [
  {
    route: '/home',
    id: 'homePage',
    label: '홈',
    icon: 'home',
    hideHeader: true,
    title: '',
    description: ''
  },
  {
    route: '/participants',
    id: 'participantsPage',
    label: '참가자',
    icon: 'participants',
    hideHeader: true,
    title: '',
    description: ''
  },
  {
    route: '/likes',
    id: 'likesPage',
    label: '호감',
    icon: 'heart',
    hideHeader: true,
    title: '',
    description: ''
  },
  {
    route: '/table',
    id: 'tablePage',
    label: '테이블',
    icon: 'table',
    title: '테이블',
    description: '내 테이블 정보와 전체 테이블 배치도를 확인합니다.'
  },
  {
    route: '/game',
    id: 'gamePage',
    label: '게임',
    icon: 'game',
    title: '게임',
    description: '진행 중인 파티 게임에 참여해보세요.'
  },
  {
    route: '/more',
    id: 'morePage',
    label: '더보기',
    icon: 'more',
    title: '더보기',
    description: '이벤트, 대화 소재, SOS 등 추가 기능을 모아두었습니다.'
  }
];

export const adminPage = {
  route: '/admin',
  id: 'adminRoutePage',
  title: '관리자',
  description: '운영자 전용 로그인과 실시간 현황 관리 화면입니다.'
};