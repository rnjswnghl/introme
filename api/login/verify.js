import { wrap } from '../../server/http.js';
import { loginVerify } from '../../server/handlers.js';

export default wrap(loginVerify, ['POST']);
