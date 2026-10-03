import { loadPhotoAssets, renderPhoto } from './photo-renderer.mjs';

const byId = id => document.getElementById(id);
const video = byId('cameraVideo');
const canvas = byId('photoCanvas');
const ctx = canvas.getContext('2d');
const photoOptions = byId('photoOptions');
const selected = name => document.querySelector(`input[name="${name}"]:checked`).value;
const status = byId('photoStatus');
const cover = byId('previewCover');
const capturedPhoto = byId('capturedPhoto');
const captureButton = byId('captureButton');
const retryButton = byId('retryCamera');
const shareButton = byId('sharePhoto');
const saveLink = byId('savePhoto');
const helpDialog = byId('helpDialog');
let assets;
let stream;
let animation;
let generation = 0;
let phase = 'idle';
let facing = 'user';
let mirror = true;
let photoURL;
let photoFile;

function setStatus(message, error = false) {
    status.textContent = message;
    byId('announcement').textContent = message;
    byId('resultNotice').hidden = phase !== 'captured' || !error;
    byId('resultNotice').textContent = error ? message : '';
}

function setPhase(next) {
    phase = next;
    photoOptions.querySelectorAll('fieldset').forEach(group => { group.disabled = next !== 'live'; });
    photoOptions.hidden = ['capturing', 'captured'].includes(next);
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
photoOptions.addEventListener('change', () => { if (phase === 'live') draw(); });
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
