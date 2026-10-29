import { wrap } from '../../server/http.js';
import { registerVerify } from '../../server/handlers.js';

export default wrap(registerVerify, ['POST']);
