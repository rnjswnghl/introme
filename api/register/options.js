import { wrap } from '../../server/http.js';
import { registerOptions } from '../../server/handlers.js';

export default wrap(registerOptions, ['POST']);
