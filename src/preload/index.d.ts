import type { NoteItAPI } from '@shared/ipc-channels'

declare global {
  interface Window {
    noteitAPI: NoteItAPI
  }
}
