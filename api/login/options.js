import { wrap } from '../../server/http.js';
import { loginOptions } from '../../server/handlers.js';

export default wrap(loginOptions, ['POST']);
