// "Reset demo" (SPEC 7): restore seed data and send the visitor back to the
// start of the story. Confirms first, because a reset throws away their work.

import { useNavigate } from "react-router-dom";
import { useStore } from "../app/store";

const CONFIRM = "Reset the demo? Every booking and note made in this session is discarded.";

export default function ScenarioReset() {
  const navigate = useNavigate();
  const resetDemo = useStore((s) => s.resetDemo);

  function onReset() {
    if (!window.confirm(CONFIRM)) return;
    resetDemo();
    navigate("/asha");
  }

  return (
    <button type="button" onClick={onReset}>
      Reset demo
    </button>
  );
}
