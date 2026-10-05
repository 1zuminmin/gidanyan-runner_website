// All placeholder frames share a 1080 × 1440 artboard. Keep characters separate.
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1440;
export const FRAMES = {
    insta: { src: 'images/photo/frame-insta.svg', photo: { x: 48, y: 190, width: 984, height: 1060 } },
    x: { src: 'images/photo/frame-x.svg', photo: { x: 48, y: 190, width: 984, height: 1060 } },
    original: { src: 'images/photo/frame-original.svg', photo: { x: 48, y: 190, width: 984, height: 1060 } },
    none: { src: null, photo: { x: 0, y: 0, width: PHOTO_WIDTH, height: PHOTO_HEIGHT } }
};
export const POSES = {
    pose1: 'images/photo/pose-1.svg',
    pose2: 'images/photo/pose-2.svg'
};
export const POSE_AREA = { x: 690, y: 855, width: 300, height: 360 };

export function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = targetWidth / scale;
    const height = targetHeight / scale;
    return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height };
}

export async function loadPhotoAssets() {
    const assets = {};
    await Promise.all([...Object.entries(FRAMES).filter(([, frame]) => frame.src).map(([key, frame]) => [key, frame.src]), ...Object.entries(POSES)].map(async ([key, src]) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        assets[key] = image;
    }));
    return assets;
}

// Preview and exported PNG use this same canvas, including crop and selfie mirroring.
export function renderPhoto(ctx, video, assets, frameKey, poseKey, mirror) {
    const area = FRAMES[frameKey].photo;
    const crop = coverCrop(video.videoWidth, video.videoHeight, area.width, area.height);
    ctx.clearRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.save();
    ctx.translate(area.x + (mirror ? area.width : 0), area.y);
    ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, area.width, area.height);
    ctx.restore();
    if (frameKey !== 'none') ctx.drawImage(assets[frameKey], 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    if (poseKey !== 'none') {
        const { x, y, width, height } = POSE_AREA;
        ctx.drawImage(assets[poseKey], x, y, width, height);
    }
}
