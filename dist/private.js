// 비공개 서랍: 패스키 등록·로그인·로그아웃과 서버에서 받은 비공개 자료 표시.
// 이 파일에는 비공개 내용이 없다. 내용은 로그인 뒤 /api/private 응답으로만 온다.
(() => {
  const panel = document.getElementById('panel-private');
  if (!panel) return;
  const webauthn = window.SimpleWebAuthnBrowser;
  const $ = (selector) => panel.querySelector(selector);
  const status = $('[data-private-status]');
  const views = { out: $('[data-auth-view="out"]'), in: $('[data-auth-view="in"]') };
  let started = false;

  // 상태 문장은 위쪽 공용 줄과, 방금 누른 폼 바로 아래에 함께 보여 준다(누른 자리에서 결과가 보이게).
  let activeForm = null;
  const say = (text, tone = 'info') => {
    status.textContent = text;
    status.dataset.tone = tone;
    panel.querySelectorAll('.form-status').forEach((el) => {
      const own = el.closest('form') === activeForm;
      el.textContent = own ? text : '';
      el.dataset.tone = own ? tone : '';
    });
  };

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || `요청 실패 (${res.status})`);
      error.status = res.status;
      error.code = data.error;
      throw error;
    }
    return data;
  }

  // 기기 창에서 일어난 오류를 사람이 읽을 문장으로 바꾼다.
  function ceremonyMessage(error, action) {
    console.warn('[t08] passkey ceremony', error.name, error.message);
    if (error.name === 'NotAllowedError') {
      return action === 'register'
        ? '등록을 취소했거나 시간이 지났습니다. 서버에는 계정도 패스키도 저장되지 않았습니다.'
        : '패스키 확인을 취소했거나 시간이 지났습니다. 서랍은 열리지 않았습니다.';
    }
    if (error.name === 'InvalidStateError') {
      return '이 기기(또는 비밀번호 관리자)에는 이미 이 계정의 패스키가 있습니다. 다른 기기나 다른 브라우저에서 등록해 보세요.';
    }
    if (error.name === 'SecurityError') return '이 주소에서는 패스키를 쓸 수 없습니다. https 주소인지 확인해 주세요.';
    return `패스키 처리 중 문제가 생겼습니다. (${error.name || 'Error'}: ${error.message || '이유 없음'})`;
  }

  function setBusy(form, busy) {
    form?.querySelectorAll('button, input, textarea').forEach((el) => {
      el.disabled = busy;
    });
  }

  function showView(name) {
    views.out.hidden = name !== 'out';
    views.in.hidden = name !== 'in';
  }

  const formatDate = (value) =>
    value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '아직 없음';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function renderNotes() {
    const data = await api('GET', '/api/private');
    $('[data-owner]').textContent = data.owner;
    $('[data-note-count]').textContent = `${data.notes.length}건`;
    const list = $('[data-notes]');
    list.replaceChildren(
      ...data.notes.map((note) => {
        const item = el('li', 'note-item');
        item.append(el('h4', '', note.title), el('p', '', note.body));
        const meta = el('div', 'note-meta');
        meta.append(el('time', '', formatDate(note.created_at)));
        if (note.kind === 'memo') {
          const remove = el('button', 'link-button', '지우기');
          remove.type = 'button';
          remove.addEventListener('click', async () => {
          activeForm = null;
            try {
              await api('DELETE', `/api/private?id=${encodeURIComponent(note.id)}`);
              say('기록을 지웠습니다.');
              await renderNotes();
            } catch (error) {
              handleApiError(error);
            }
          });
          meta.append(remove);
        }
        item.append(meta);
        return item;
      }),
    );
  }

  async function renderPasskeys() {
    const data = await api('GET', '/api/passkeys');
    $('[data-passkey-count]').textContent = `${data.passkeys.length}개`;
    const onlyOne = data.passkeys.length === 1;
    $('[data-passkeys]').replaceChildren(
      ...data.passkeys.map((key) => {
        const item = el('li', 'passkey-item');
        const head = el('div', 'passkey-head');
        head.append(el('h4', '', key.name));
        if (key.current) head.append(el('span', 'badge', '지금 이 열쇠로 들어옴'));
        const facts = el('dl', 'passkey-facts');
        for (const [label, value] of [
          ['저장된 곳', key.storedIn],
          ['등록', formatDate(key.createdAt)],
          ['마지막 사용', formatDate(key.lastUsedAt)],
        ]) {
          facts.append(el('dt', '', label), el('dd', '', value));
        }
        const remove = el('button', 'link-button', onlyOne ? '마지막 하나라 지울 수 없음' : '이 패스키 지우기');
        remove.type = 'button';
        remove.disabled = onlyOne;
        remove.addEventListener('click', async () => {
          activeForm = null;
          if (!window.confirm(`'${key.name}' 패스키를 지울까요? 지운 뒤에는 이 열쇠로 들어올 수 없습니다.`)) return;
          try {
            const result = await api('DELETE', `/api/passkeys?id=${encodeURIComponent(key.id)}`);
            say(`패스키를 지웠습니다. 남은 패스키 ${result.remaining}개.`);
            await renderPasskeys();
          } catch (error) {
            handleApiError(error);
          }
        });
        item.append(head, facts, remove);
        return item;
      }),
    );
  }

  function handleApiError(error) {
    if (error.status === 401) {
      showView('out');
      say('들어온 상태가 끝났습니다. 패스키로 다시 들어와 주세요.', 'error');
      return;
    }
    say(error.message, 'error');
  }

  async function openDrawer() {
    showView('in');
    await Promise.all([renderNotes(), renderPasskeys()]);
  }

  async function start() {
    if (started) return;
    started = true;
    if (!webauthn?.browserSupportsWebAuthn()) {
      say('이 브라우저는 패스키를 지원하지 않습니다. 최신 Chrome·Safari·Edge에서 열어 주세요.', 'error');
    }
    try {
      const me = await api('GET', '/api/me');
      // 패스키는 공식 주소 하나에만 묶인다. Vercel 배포별 주소 등으로 열었으면 공식 주소로 안내하고 폼을 잠근다.
      if (me.origin && me.origin !== location.origin) {
        showView('out');
        lockForms(me.origin);
        return;
      }
      if (me.authenticated) await openDrawer();
      else showView('out');
    } catch (error) {
      showView('out');
      if (error.status === 503) say('서랍 저장소가 아직 연결되지 않았습니다. 공개 영역은 그대로 볼 수 있습니다.', 'error');
    }
  }

  function lockForms(origin) {
    views.out.querySelectorAll('button, input').forEach((el) => {
      el.disabled = true;
    });
    status.replaceChildren(
      '지금 주소에서는 패스키를 쓸 수 없습니다. 패스키는 공식 주소에만 묶입니다 → ',
      Object.assign(document.createElement('a'), { href: `${origin}/#private`, textContent: `${new URL(origin).host} 에서 열기` }),
    );
    status.dataset.tone = 'error';
  }

  $('[data-register-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    activeForm = form;
    const fields = new FormData(form);
    setBusy(form, true);
    say('기기에서 패스키를 만들어 주세요. 지문·얼굴·화면 잠금으로 확인합니다.');
    try {
      const optionsJSON = await api('POST', '/api/register/options', { username: fields.get('username') });
      const response = await webauthn.startRegistration({ optionsJSON });
      await api('POST', '/api/register/verify', { response, name: fields.get('name') || defaultName() });
      form.reset();
      say('패스키를 등록하고 서랍을 열었습니다. 서버에는 공개키만 저장됐습니다.', 'ok');
      await openDrawer();
    } catch (error) {
      say(error.status ? error.message : ceremonyMessage(error, 'register'), 'error');
    } finally {
      setBusy(form, false);
    }
  });

  $('[data-login-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    activeForm = form;
    const username = new FormData(form).get('username')?.trim();
    setBusy(form, true);
    say('기기에서 패스키를 골라 확인해 주세요.');
    try {
      const optionsJSON = await api('POST', '/api/login/options', username ? { username } : {});
      const response = await webauthn.startAuthentication({ optionsJSON });
      await api('POST', '/api/login/verify', { response });
      form.reset();
      say('서명을 확인하고 서랍을 열었습니다.', 'ok');
      await openDrawer();
    } catch (error) {
      say(error.status ? error.message : ceremonyMessage(error, 'login'), 'error');
    } finally {
      setBusy(form, false);
    }
  });

  $('[data-add-passkey-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    activeForm = form;
    const name = new FormData(form).get('name') || defaultName();
    setBusy(form, true);
    say('새 기기나 다른 비밀번호 관리자에서 패스키를 만들어 주세요.');
    try {
      const optionsJSON = await api('POST', '/api/passkeys/options', {});
      const response = await webauthn.startRegistration({ optionsJSON });
      await api('POST', '/api/passkeys/verify', { response, name });
      form.reset();
      say('패스키를 하나 더 등록했습니다.', 'ok');
      await renderPasskeys();
    } catch (error) {
      if (error.status) handleApiError(error);
      else say(ceremonyMessage(error, 'register'), 'error');
    } finally {
      setBusy(form, false);
    }
  });

  $('[data-note-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    activeForm = form;
    const fields = new FormData(form);
    setBusy(form, true);
    try {
      await api('POST', '/api/private', { title: fields.get('title'), body: fields.get('body') });
      form.reset();
      say('기록을 넣었습니다.', 'ok');
      await renderNotes();
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(form, false);
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    activeForm = null;
    try {
      await api('POST', '/api/logout', {});
    } finally {
      $('[data-notes]').replaceChildren();
      $('[data-passkeys]').replaceChildren();
      showView('out');
      say('서랍을 닫았습니다. 같은 세션 값은 서버에서 지워져 다시 쓸 수 없습니다.', 'ok');
    }
  });

  function defaultName() {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '기기';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '브라우저';
    return `${os} ${browser}`;
  }

  document.addEventListener('folder-change', (event) => {
    if (event.detail === 'private') start();
  });
  if (!panel.hidden) start();
})();
