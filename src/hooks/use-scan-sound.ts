import { useSound } from "react-sounds";

const MAX_VOL = { volume: 1.0 };

export function useScanSound() {
  const { play: playInfo } = useSound("notification/info", MAX_VOL);
  const { play: playSuccess } = useSound("notification/success", MAX_VOL);
  const { play: playWarning } = useSound("notification/warning", MAX_VOL);

  return {
    playInfo: () => void playInfo(MAX_VOL),
    playSuccess: () => void playSuccess(MAX_VOL),
    playWarning: () => void playWarning(MAX_VOL),
  };
}
