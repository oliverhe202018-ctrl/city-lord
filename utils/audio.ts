
export const playAudio = (filename: string) => {
  try {
    const audio = new Audio(`/sounds/${filename}`);
    audio.volume = 0.8;
    audio.play().catch(e => console.error(`Audio play failed for ${filename}:`, e));
  } catch (e) {
    console.error(`Error creating audio for ${filename}:`, e);
  }
};
