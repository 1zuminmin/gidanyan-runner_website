// Frames are transparent overlays on a shared 1080 × 1440 artboard.
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1440;
export const FRAMES = {
    insta: { src: 'images/photo/frame-insta.svg' },
    x: { src: 'images/photo/frame-x.svg' },
    original: { src: 'images/photo/frame-original.svg' },
    none: { src: null }
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
    // The camera crop stays fixed when frames change, including OFF.
    const crop = coverCrop(video.videoWidth, video.videoHeight, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.clearRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.save();
    ctx.translate(mirror ? PHOTO_WIDTH : 0, 0);
    ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.restore();
    if (frameKey !== 'none') ctx.drawImage(assets[frameKey], 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    if (poseKey !== 'none') {
        const { x, y, width, height } = POSE_AREA;
        ctx.drawImage(assets[poseKey], x, y, width, height);
    }
}
