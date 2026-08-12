const supabase = require('../supabase');

const STATE_ID = 'main';

function validateMenus(menus) {
  if (!menus || typeof menus !== 'object') {
    throw new Error('Invalid menus data');
  }

  if (!Array.isArray(menus.unlimited)) {
    menus.unlimited = [];
  }

  if (!Array.isArray(menus.bar)) {
    menus.bar = [];
  }

  return menus;
}

async function getMenus() {
  const { data, error } = await supabase
    .from('app_state')
    .select('menus')
    .eq('id', STATE_ID)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read menu from Supabase: ${error.message}`
    );
  }

  if (data && data.menus) {
    return validateMenus(data.menus);
  }

  return null;
}

async function saveMenus(menus) {
  menus = validateMenus(menus);

  const { data, error } = await supabase
    .from('app_state')
    .upsert(
      {
        id: STATE_ID,
        menus,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'id'
      }
    )
    .select('menus')
    .single();

  if (error) {
    throw new Error(
      `Could not save menu to Supabase: ${error.message}`
    );
  }

  return data.menus;
}

module.exports = {
  getMenus,
  saveMenus
};
