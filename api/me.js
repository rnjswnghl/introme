import { wrap } from '../server/http.js';
import { me } from '../server/handlers.js';

export default wrap(me, ['GET']);
