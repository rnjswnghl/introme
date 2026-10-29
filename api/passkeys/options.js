import { wrap } from '../../server/http.js';
import { addPasskeyOptions } from '../../server/handlers.js';

export default wrap(addPasskeyOptions, ['POST']);
