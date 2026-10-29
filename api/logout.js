import { wrap } from '../server/http.js';
import { logout } from '../server/handlers.js';

export default wrap(logout, ['POST']);
