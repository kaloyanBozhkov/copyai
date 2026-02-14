// defaults to not crash app
import "./env";
import { join } from "path";

// load .env 
import * as dotenv from "dotenv";
dotenv.config({ path: join(__dirname, "..", ".env"), override: true });

import "./app";
