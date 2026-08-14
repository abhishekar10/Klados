// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_wild_black_crow.sql';
import m0001 from './0001_rainy_lord_hawal.sql';
import m0002 from './0002_bright_medusa.sql';
import m0003 from './0003_dark_vulture.sql';
import m0004 from './0004_married_agent_brand.sql';
import m0005 from './0005_unknown_molecule_man.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  