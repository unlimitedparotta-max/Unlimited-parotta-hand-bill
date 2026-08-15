const supabase = require('../supabase');

/*
 * Get the current business date in India.
 *
 * IMPORTANT:
 * The restaurant operates in India, so we must NOT depend
 * on the server/Vercel timezone.
 *
 * Business date changes at midnight IST.
 */
function getBusinessDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(new Date());
}


/*
 * Get today's orders using the restaurant business date.
 */
async function getTodaySummary(req, res) {
  try {
    const businessDate =
      req.query.date || getBusinessDate();

    const start = `${businessDate}T00:00:00`;
    const end = `${businessDate}T23:59:59.999`;

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .gte('time', start)
      .lte('time', end)
      .order('time', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const list = orders || [];

    let cashSales = 0;
    let upiSales = 0;
    let swiggySales = 0;
    let zomatoSales = 0;

    for (const order of list) {
      const total = Number(order.total || 0);

      const method = String(
        order.payment_method || 'cash'
      ).toLowerCase();

      if (method === 'cash') {
        cashSales += total;
      } else if (
        method === 'gpay' ||
        method === 'upi'
      ) {
        upiSales += total;
      } else if (method === 'swiggy') {
        swiggySales += total;
      } else if (method === 'zomato') {
        zomatoSales += total;
      }
    }

    const totalSales =
      cashSales +
      upiSales +
      swiggySales +
      zomatoSales;

    res.json({
      ok: true,
      businessDate,

      totalOrders: list.length,

      cashSales,
      upiSales,
      swiggySales,
      zomatoSales,

      totalSales
    });

  } catch (error) {
    console.error(
      'Day closing summary error:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Could not calculate day summary'
    });
  }
}


/*
 * Get closing for a particular business date.
 */
async function getClosing(req, res) {
  try {
    const businessDate =
      req.query.date || getBusinessDate();

    const { data, error } = await supabase
      .from('day_closings')
      .select('*')
      .eq('business_date', businessDate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      businessDate,
      closing: data || null
    });

  } catch (error) {
    console.error(
      'Get day closing error:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Could not load day closing'
    });
  }
}


/*
 * Close a business day.
 *
 * IMPORTANT:
 * This DOES NOT delete orders.
 *
 * It creates a permanent record in:
 *
 *     day_closings
 *
 * The orders remain permanently in:
 *
 *     orders
 */
async function closeDay(req, res) {
  try {
    const businessDate =
      req.body.date || getBusinessDate();

    const actualCash =
      Number(req.body.actualCash);

    const notes =
      String(req.body.notes || '')
        .trim()
        .slice(0, 1000);

    if (
      !Number.isFinite(actualCash) ||
      actualCash < 0
    ) {
      return res.status(400).json({
        error: 'Enter a valid actual cash amount'
      });
    }

    /*
     * Get all orders for this business date.
     */
    const start = `${businessDate}T00:00:00`;
    const end = `${businessDate}T23:59:59.999`;

    const {
      data: orders,
      error: ordersError
    } = await supabase
      .from('orders')
      .select('*')
      .gte('time', start)
      .lte('time', end);

    if (ordersError) {
      throw new Error(ordersError.message);
    }

    const list = orders || [];

    let cashSales = 0;
    let upiSales = 0;
    let swiggySales = 0;
    let zomatoSales = 0;

    for (const order of list) {
      const total = Number(order.total || 0);

      const method =
        String(
          order.payment_method || 'cash'
        ).toLowerCase();

      if (method === 'cash') {
        cashSales += total;
      } else if (
        method === 'gpay' ||
        method === 'upi'
      ) {
        upiSales += total;
      } else if (method === 'swiggy') {
        swiggySales += total;
      } else if (method === 'zomato') {
        zomatoSales += total;
      }
    }

    const totalSales =
      cashSales +
      upiSales +
      swiggySales +
      zomatoSales;

    /*
     * Cash sales are the expected cash in drawer.
     */
    const expectedCash = cashSales;

    const difference =
      actualCash - expectedCash;

    /*
     * Check whether this date has already been closed.
     */
    const {
      data: existing,
      error: existingError
    } = await supabase
      .from('day_closings')
      .select('*')
      .eq('business_date', businessDate)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    /*
     * Prevent duplicate closing.
     */
    if (
      existing &&
      existing.status === 'closed'
    ) {
      return res.status(400).json({
        error:
          `Business day ${businessDate} is already closed`
      });
    }

    const now = new Date().toISOString();

    const payload = {
      business_date: businessDate,

      total_orders: list.length,

      cash_sales: cashSales,
      upi_sales: upiSales,
      swiggy_sales: swiggySales,
      zomato_sales: zomatoSales,

      total_sales: totalSales,

      expected_cash: expectedCash,
      actual_cash: actualCash,

      difference,

      notes,

      closed_by: req.role || 'admin',

      closed_at: now,

      status: 'closed',

      updated_at: now
    };

    let result;

    if (existing) {
      result = await supabase
        .from('day_closings')
        .update(payload)
        .eq('business_date', businessDate)
        .select()
        .single();
    } else {
      result = await supabase
        .from('day_closings')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    res.json({
      ok: true,
      businessDate,
      closing: result.data
    });

  } catch (error) {
    console.error(
      'Close day error:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Could not close business day'
    });
  }
}


/*
 * Get previous closing history.
 *
 * This data is NEVER reset.
 */
async function getHistory(req, res) {
  try {
    const { data, error } = await supabase
      .from('day_closings')
      .select('*')
      .order('business_date', {
        ascending: false
      })
      .limit(100);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      closings: data || []
    });

  } catch (error) {
    console.error(
      'Day closing history error:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Could not load closing history'
    });
  }
}


module.exports = {
  getTodaySummary,
  getClosing,
  closeDay,
  getHistory
};
