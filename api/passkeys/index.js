import { wrap } from '../../server/http.js';
import { passkeys } from '../../server/handlers.js';

export default wrap(passkeys, ['GET', 'DELETE']);
