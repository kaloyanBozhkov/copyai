import { useEffect, useState } from "react";
import {
  Checkbox,
  CheckboxIndicator,
} from "../animate-ui/primitives/headless/checkbox";

export const CheckAnimated = ({
  onAnimationComplete,
}: {
  onAnimationComplete: () => void;
}) => {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    const tId = setTimeout(() => {
      setIsChecked(true);
      onAnimationComplete();
    }, 800);
    return () => clearTimeout(tId);
  }, []);

  return (
    <Checkbox checked disabled className="[&_svg]:drop-shadow-layered">
      <CheckboxIndicator className="text-white" />{" "}
      <span className="text-white text-shadow-layered">
        Ready
      </span>
    </Checkbox>
  );
};
