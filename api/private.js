import { wrap } from '../server/http.js';
import { privateNotes } from '../server/handlers.js';

export default wrap(privateNotes, ['GET', 'POST', 'DELETE']);
