const supabase = require('../supabase');

/*
 * GET ACTIVE INGREDIENTS
 * Admin only
 */
async function getIngredients(req, res) {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
  ok: true,
  ingredients: data || [],
  inventory: (data || []).map(item => ({
    ...item,
    quantity: item.current_stock ?? 0,
    low_stock: item.minimum_stock ?? 0
  }))
});

  } catch (error) {
    console.error('Get inventory error:', error);

    res.status(500).json({
      error: error.message || 'Could not load inventory'
    });
  }
}


/*
 * ADD INGREDIENT
 * Admin only
 */
async function addIngredient(req, res) {
  try {
    const name = String(req.body.name || '').trim();
    const unit = String(req.body.unit || '').trim();
    const minimumStock = Number(req.body.minimumStock || 0);
    const currentStock = Number(req.body.currentStock || 0);
    const purchasePrice = Number(req.body.purchasePrice || 0);
    const supplier = String(req.body.supplier || '').trim();

    if (!name) {
      return res.status(400).json({
        error: 'Ingredient name is required'
      });
    }

    if (!unit) {
      return res.status(400).json({
        error: 'Unit is required'
      });
    }

    if (
      !Number.isFinite(minimumStock) ||
      minimumStock < 0
    ) {
      return res.status(400).json({
        error: 'Invalid minimum stock'
      });
    }

    if (
      !Number.isFinite(currentStock) ||
      currentStock < 0
    ) {
      return res.status(400).json({
        error: 'Invalid current stock'
      });
    }

    if (
      !Number.isFinite(purchasePrice) ||
      purchasePrice < 0
    ) {
      return res.status(400).json({
        error: 'Invalid purchase price'
      });
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        name,
        unit,
        minimum_stock: minimumStock,
        current_stock: currentStock,
        purchase_price: purchasePrice,
        supplier,
        active: true,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.status(201).json({
      ok: true,
      ingredient: data
    });

  } catch (error) {
    console.error('Add ingredient error:', error);

    res.status(500).json({
      error: error.message || 'Could not add ingredient'
    });
  }
}


/*
 * MODIFY INGREDIENT
 * Admin only
 */
async function updateIngredient(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'Invalid ingredient ID'
      });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();

      if (!name) {
        return res.status(400).json({
          error: 'Ingredient name cannot be empty'
        });
      }

      updates.name = name;
    }

    if (req.body.unit !== undefined) {
      const unit = String(req.body.unit).trim();

      if (!unit) {
        return res.status(400).json({
          error: 'Unit cannot be empty'
        });
      }

      updates.unit = unit;
    }

    if (req.body.minimumStock !== undefined) {
      const value = Number(req.body.minimumStock);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({
          error: 'Invalid minimum stock'
        });
      }

      updates.minimum_stock = value;
    }

    if (req.body.currentStock !== undefined) {
      const value = Number(req.body.currentStock);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({
          error: 'Invalid current stock'
        });
      }

      updates.current_stock = value;
    }

    if (req.body.purchasePrice !== undefined) {
      const value = Number(req.body.purchasePrice);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({
          error: 'Invalid purchase price'
        });
      }

      updates.purchase_price = value;
    }

    if (req.body.supplier !== undefined) {
      updates.supplier =
        String(req.body.supplier || '').trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        error: 'No changes provided'
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', id)
      .eq('active', true)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      ingredient: data
    });

  } catch (error) {
    console.error('Update ingredient error:', error);

    res.status(500).json({
      error:
        error.message ||
        'Could not update ingredient'
    });
  }
}


/*
 * DELETE INGREDIENT
 *
 * Soft delete.
 * We DO NOT physically delete the database row.
 * This protects previous inventory records and recipes.
 */
async function deleteIngredient(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'Invalid ingredient ID'
      });
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('active', true)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      message: 'Ingredient deleted',
      ingredient: data
    });

  } catch (error) {
    console.error('Delete ingredient error:', error);

    res.status(500).json({
      error:
        error.message ||
        'Could not delete ingredient'
    });
  }
}


/*
 * RESTORE INGREDIENT
 * Useful if Admin accidentally deletes an ingredient.
 */
async function restoreIngredient(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'Invalid ingredient ID'
      });
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      ingredient: data
    });

  } catch (error) {
    console.error('Restore ingredient error:', error);

    res.status(500).json({
      error:
        error.message ||
        'Could not restore ingredient'
    });
  }
}


/*
 * GET ALL INGREDIENTS INCLUDING DELETED
 * Admin only.
 */
async function getAllIngredients(req, res) {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('active', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      ingredients: data || []
    });

  } catch (error) {
    console.error(
      'Get all inventory error:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Could not load all ingredients'
    });
  }
}


module.exports = {
  getIngredients,
  getAllIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  restoreIngredient
};
