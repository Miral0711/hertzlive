import { state, render } from '../shared/core.js';
import { DIALOGS } from './registry';
import Modal, { ModalActions } from './Modal';
import { Btn } from '../ui/ui';
import { closeDialog } from './session';
import { useStore } from '../shared/store';

export default function DialogHost() {
  useStore();
  const d = state.desk.dialog;
  if (!d) return null;
  const Dialog = DIALOGS[d.kind];
  if (!Dialog) {
    return (
      <Modal title="Not available">
        <p>This dialog ({d.kind}) has not been ported yet.</p>
        <ModalActions><Btn onClick={() => { closeDialog(); render(); }}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  return <Dialog d={d} />;
}
