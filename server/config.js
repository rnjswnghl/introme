// 배포 주소와 패스키가 묶이는 기준값. 요청의 Host를 믿지 않고 환경변수로 고정한다.
const origin = (process.env.T08_ORIGIN || 'http://localhost:4180').replace(/\/$/, '');

export const config = {
  origin,
  rpID: process.env.T08_RP_ID || new URL(origin).hostname,
  rpName: '작업 기록 · 비공개 서랍',
  secure: origin.startsWith('https://'),
  challengeTtlMs: 5 * 60 * 1000,
  sessionTtlMs: 8 * 60 * 60 * 1000,
};

export const sessionCookieName = config.secure ? '__Host-t08_session' : 't08_session';
