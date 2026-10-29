// 등록 응답의 AAGUID로 패스키를 저장한 곳을 표시한다.
// 출처: passkey-authenticator-aaguids(커뮤니티 목록)에서 이 과제에 필요한 항목만 골랐다.
const KNOWN = {
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google 비밀번호 관리자',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome (Mac)',
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud 키체인',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud 키체인 (관리형)',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
  'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
};

export function describeAuthenticator(aaguid, deviceType, backedUp) {
  const name = KNOWN[aaguid];
  if (name) return name;
  if (backedUp || deviceType === 'multiDevice') return '동기화되는 패스키 관리자 (종류 미확인)';
  return '이 기기 안 (보안키·기기 전용, 종류 미확인)';
}
