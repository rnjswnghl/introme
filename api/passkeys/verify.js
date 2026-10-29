import { wrap } from '../../server/http.js';
import { addPasskeyVerify } from '../../server/handlers.js';

export default wrap(addPasskeyVerify, ['POST']);
