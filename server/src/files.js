import { unlink } from 'node:fs/promises'
import path from 'node:path'

/** Rule 16: unlinks the stored files of these proofs after their rows are gone. A failure is logged by proof id only; B2 adds the rest of this file. */
export async function removeFiles(proofIds) {
  const done = await Promise.allSettled(proofIds.map((id) => unlink(path.join(process.env.UPLOAD_DIR, id))))
  done.forEach((result, i) => {
    if (result.status === 'rejected' && result.reason?.code !== 'ENOENT') console.error('could not remove the file of proof', proofIds[i])
  })
}
