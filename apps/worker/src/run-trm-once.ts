// Ejecuta un refresco de TRM una sola vez (sin Redis). Útil para pruebas.
import { refreshTrm } from './trm';

refreshTrm()
  .then((r) => {
    console.log('TRM actualizada:', r);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
