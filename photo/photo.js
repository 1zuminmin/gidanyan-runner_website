import { loadPhotoAssets, renderPhoto, PHOTO_WIDTH, PHOTO_HEIGHT } from './photo-renderer.mjs?v=20261007-structure1';

const byId = id => document.getElementById(id);
const video = byId('cameraVideo');
const canvas = byId('photoCanvas');
const ctx = canvas.getContext('2d');
const photoOptions = byId('photoOptions');
const selected = name => byId(`${name}Button`).value;
const choices = { frame: ['insta', 'x', 'original', 'none'], pose: ['pose1', 'pose2', 'none'] };
const status = byId('photoStatus');
const cover = byId('previewCover');
const capturedPhoto = byId('capturedPhoto');
const captureButton = byId('captureButton');
const retryButton = byId('retryCamera');
const shareButton = byId('sharePhoto');
const saveLink = byId('savePhoto');
const helpDialog = byId('helpDialog');
const preview = document.querySelector('.photo-preview');
const main = document.querySelector('.photo-main');
const controls = document.querySelector('.photo-controls');
let assets;
let stream;
let animation;
let generation = 0;
let phase = 'idle';
let facing = 'user';
let mirror = true;
let photoURL;
let photoFile;

function fitPreview() {
    const style = getComputedStyle(main);
    const border = getComputedStyle(preview);
    let width = main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    let height = main.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (style.flexDirection === 'row') width -= controls.offsetWidth + parseFloat(style.columnGap);
    else height -= controls.offsetHeight + parseFloat(style.rowGap);
    width -= parseFloat(border.borderLeftWidth) + parseFloat(border.borderRightWidth);
    height -= parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth);
    const photoWidth = Math.max(0, Math.min(width, height * PHOTO_WIDTH / PHOTO_HEIGHT));
    preview.style.width = `${photoWidth}px`;
    preview.style.height = `${photoWidth * PHOTO_HEIGHT / PHOTO_WIDTH}px`;
}

const previewSize = new ResizeObserver(fitPreview);
previewSize.observe(main);
previewSize.observe(controls);
fitPreview();

function setStatus(message, error = false) {
    status.textContent = message;
    byId('announcement').textContent = message;
    byId('resultNotice').hidden = phase !== 'captured' || !error;
    byId('resultNotice').textContent = error ? message : '';
}

function setPhase(next) {
    phase = next;
    photoOptions.querySelectorAll('button').forEach(button => { button.disabled = next !== 'live'; });
    byId('liveControls').hidden = ['capturing', 'captured'].includes(next);
    byId('switchCamera').disabled = next !== 'live';
    byId('cameraActions').hidden = ['capturing', 'captured'].includes(next);
    captureButton.disabled = next !== 'live';
    captureButton.hidden = ['capturing', 'captured', 'error', 'paused'].includes(next);
    retryButton.hidden = !['error', 'paused'].includes(next);
    byId('resultActions').hidden = next !== 'captured';
    capturedPhoto.hidden = next !== 'captured';
    canvas.hidden = next === 'captured';
    cover.hidden = ['live', 'capturing', 'captured'].includes(next);
}

function stopCamera() {
    generation++;
    cancelAnimationFrame(animation);
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = undefined;
    video.srcObject = null;
}

function clearPhoto() {
    capturedPhoto.removeAttribute('src');
    saveLink.removeAttribute('href');
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = undefined;
    photoFile = undefined;
}

function showError(message) {
    stopCamera();
    setPhase('error');
    byId('previewMessage').textContent = 'カメラを起動できませんでした';
    setStatus(message, true);
}

function cameraError(error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'カメラの利用が許可されていません。ブラウザのサイト設定でカメラを許可して、もう一度起動してください。';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return '使えるカメラが見つかりません。カメラを接続するか、カメラ付きの端末で開いてください。';
    if (error.name === 'NotReadableError' || error.name === 'AbortError') return 'カメラを使用できません。他のアプリでカメラを使用している場合は閉じて、もう一度お試しください。';
    return 'カメラの映像を読み込めませんでした。もう一度起動してください。';
}

function draw() {
    renderPhoto(ctx, video, assets, selected('frame'), selected('pose'), mirror);
}

function drawLive() {
    if (phase !== 'live') return;
    if (video.readyState >= 2 && video.videoWidth > 0) draw();
    animation = requestAnimationFrame(drawLive);
}

async function startCamera() {
    if (phase === 'opening') return;
    stopCamera();
    clearPhoto();
    setPhase('opening');
    setStatus('カメラの利用を許可してください。');
    byId('previewMessage').textContent = 'カメラを準備しています…';
    if (!window.isSecureContext) {
        showError('カメラを使うにはHTTPSのページで開いてください。開発中はlocalhostでも利用できます。');
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !ctx) {
        showError('このブラウザではカメラを利用できません。SafariやChromeなどのブラウザで開いてください。');
        return;
    }
    const request = generation;
    const timeout = window.setTimeout(() => {
        if (request === generation) showError('カメラの準備が完了しませんでした。利用の許可を確認して、もう一度起動してください。');
    }, 30000);
    try {
        if (!assets) {
            try { assets = await loadPhotoAssets(); }
            catch { throw new Error('assets'); }
        }
        if (request !== generation) return;
        const opened = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: facing }, width: { ideal: 1440 }, height: { ideal: 1080 } }
        });
        // Permission can resolve after leaving the page, timing out, or starting a newer request.
        if (request !== generation) {
            opened.getTracks().forEach(track => track.stop());
            return;
        }
        stream = opened;
        const track = stream.getVideoTracks()[0];
        mirror = (track.getSettings().facingMode || facing) === 'user';
        track.addEventListener('ended', () => {
            if (stream === opened) showError('カメラとの接続が切れました。もう一度起動してください。');
        });
        video.srcObject = opened;
        await video.play();
        if (request !== generation) return;
        if (!video.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error('video');
        setPhase('live');
        setStatus('撮影できます。');
        drawLive();
    } catch (error) {
        if (request === generation) showError(error.message === 'assets'
            ? 'フレーム画像を読み込めませんでした。通信を確認して、もう一度起動してください。'
            : cameraError(error));
    } finally {
        window.clearTimeout(timeout);
    }
}

captureButton.addEventListener('click', () => {
    if (phase !== 'live' || video.readyState < 2) return;
    draw();
    setPhase('capturing');
    stopCamera();
    const capture = generation;
    setStatus('写真を作成しています…');
    canvas.toBlob(blob => {
        if (capture !== generation) return;
        if (!blob) {
            showError('写真を作成できませんでした。もう一度撮影してください。');
            return;
        }
        photoURL = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `gidanyan-photo-${timestamp}.png`;
        photoFile = new File([blob], filename, { type: 'image/png' });
        capturedPhoto.src = photoURL;
        saveLink.href = photoURL;
        saveLink.download = filename;
        let canShare = false;
        try { canShare = Boolean(navigator.share && navigator.canShare?.({ files: [photoFile] })); } catch { /* Download remains available. */ }
        shareButton.hidden = !canShare;
        setPhase('captured');
        setStatus('撮影しました。保存または撮り直しができます。');
        saveLink.focus({ preventScroll: true });
    }, 'image/png');
});

shareButton.addEventListener('click', async () => {
    if (!photoFile) return;
    shareButton.disabled = true;
    try { await navigator.share({ files: [photoFile] }); }
    catch (error) {
        if (error.name !== 'AbortError') setStatus('共有できませんでした。「保存」または画像の長押しをお試しください。', true);
    } finally { shareButton.disabled = false; }
});

byId('switchCamera').addEventListener('click', () => {
    facing = facing === 'user' ? 'environment' : 'user';
    startCamera();
});
for (const [name, values] of Object.entries(choices)) {
    const button = byId(`${name}Button`);
    button.addEventListener('click', () => {
        if (phase !== 'live') return;
        const index = (values.indexOf(button.value) + 1) % values.length;
        button.value = values[index];
        const count = button.value === 'none' ? 'OFF' : `${index + 1} / ${values.length - 1}`;
        const label = name === 'frame' ? 'フレーム' : 'ポーズ';
        byId(`${name}Count`).textContent = count;
        button.setAttribute('aria-label', `${label}：${count}。押すと切り替え`);
        byId('announcement').textContent = `${label}：${count}`;
        draw();
    });
}
byId('helpButton').addEventListener('click', () => helpDialog.showModal());
helpDialog.addEventListener('click', event => {
    const bounds = helpDialog.getBoundingClientRect();
    if (event.target === helpDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) helpDialog.close();
});
byId('retakeButton').addEventListener('click', startCamera);
retryButton.addEventListener('click', startCamera);
byId('homeLink').addEventListener('click', () => { stopCamera(); clearPhoto(); });

document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['opening', 'live'].includes(phase)) {
        stopCamera();
        setPhase('paused');
        byId('previewMessage').textContent = 'カメラを停止しました';
        setStatus('「起動」を押すと撮影を再開できます。');
    }
});
window.addEventListener('pagehide', () => { stopCamera(); clearPhoto(); });
window.addEventListener('pageshow', event => {
    if (event.persisted) {
        setPhase('paused');
        byId('previewMessage').textContent = 'カメラを停止しました';
        setStatus('「起動」を押すと撮影を再開できます。');
    }
});

startCamera();
