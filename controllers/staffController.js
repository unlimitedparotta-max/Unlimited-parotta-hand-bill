const supabase = require('../supabase');


// ========================================
// GET STAFF
// ========================================
async function getStaff(req, res) {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select(`
        id,
        name,
        role,
        phone,
        daily_salary,
        active
      `)
      .order('id', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      staff: data || []
    });

  } catch (error) {
    console.error('Get staff error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ========================================
// GET TODAY ATTENDANCE + SALARY
// ========================================
async function getTodayStaff(req, res) {
  try {
   const today =
  new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata'
    }
  ).format(new Date());

    const { data, error } = await supabase
      .from('staff')
      .select(`
        id,
        name,
        role,
        phone,
        daily_salary,
        active,
        staff_attendance (
          id,
          attendance_date,
          status,
          check_in,
          check_out
        ),
        staff_daily_salary (
          id,
          salary_date,
          attendance_status,
          daily_salary,
          overtime,
          deduction,
          net_salary,
          paid,
          paid_at
        )
      `)
      .eq('active', true)
      .order('id', { ascending: true });

    if (error) throw error;

    const result = (data || []).map(staff => {

      const attendance =
        (staff.staff_attendance || [])
          .find(a => a.attendance_date === today);

      const salary =
        (staff.staff_daily_salary || [])
          .find(s => s.salary_date === today);

      return {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        phone: staff.phone,
        daily_salary: Number(staff.daily_salary || 0),

        attendance: attendance || null,

        salary: salary || null
      };
    });

    res.json({
      success: true,
      date: today,
      staff: result
    });

  } catch (error) {
    console.error('Get today staff error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ========================================
// MARK ATTENDANCE
// ========================================
async function markAttendance(req, res) {
  try {

    const {
      staff_id,
      status,
      check_in,
      check_out
    } = req.body;

    if (!staff_id) {
      return res.status(400).json({
        success: false,
        error: 'staff_id is required'
      });
    }

    const attendance_date =
      new Intl.DateTimeFormat(
  'en-CA',
  {
    timeZone: 'Asia/Kolkata'
  }
).format(new Date())

    const { data, error } = await supabase
      .from('staff_attendance')
      .upsert(
        {
          staff_id,
          attendance_date,
          status: status || 'present',
          check_in: check_in || null,
          check_out: check_out || null
        },
        {
          onConflict: 'staff_id,attendance_date'
        }
      )
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      attendance: data
    });

  } catch (error) {
    console.error('Mark attendance error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ========================================
// CREATE / UPDATE DAILY SALARY
// ========================================
async function saveDailySalary(req, res) {
  try {

    const {
      staff_id,
      attendance_status,
      salary_amount,
      overtime,
      deduction
    } = req.body;

    if (!staff_id) {
      return res.status(400).json({
        success: false,
        error: 'staff_id is required'
      });
    }

    const { data: staff, error: staffError } =
      await supabase
        .from('staff')
        .select('daily_salary')
        .eq('id', staff_id)
        .single();

    if (staffError) throw staffError;

  const dailySalary =
  Number(staff.daily_salary || 0);

const manualSalary =
  salary_amount !== undefined &&
  salary_amount !== ''
    ? Number(salary_amount)
    : dailySalary;

    const overtimeAmount =
      Number(overtime || 0);

    const deductionAmount =
      Number(deduction || 0);

    const baseSalary = manualSalary;

    const netSalary =
      Math.max(
        0,
        baseSalary +
        overtimeAmount -
        deductionAmount
      );

    const salary_date =
  new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata'
    }
  ).format(new Date());

    const { data, error } =
      await supabase
        .from('staff_daily_salary')
        .upsert(
          {
            staff_id,
            salary_date,
            attendance_status:
              attendance_status || 'present',
            daily_salary: baseSalary,
            overtime: overtimeAmount,
            deduction: deductionAmount,
            net_salary: netSalary
          },
          {
            onConflict: 'staff_id,salary_date'
          }
        )
        .select()
        .single();

    if (error) throw error;

    res.json({
      success: true,
      salary: data
    });

  } catch (error) {
    console.error('Save salary error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ========================================
// MARK SALARY PAID
// ========================================
async function markSalaryPaid(req, res) {
  try {

    const { id } = req.params;

    const { data, error } =
      await supabase
        .from('staff_daily_salary')
        .update({
          paid: true,
          paid_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
      success: true,
      salary: data
    });

  } catch (error) {
    console.error('Mark salary paid error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========================================
// ADD STAFF
// ========================================
async function addStaff(req, res) {
  try {
    const {
      name,
      role,
      phone,
      daily_salary,
      active
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Staff name is required'
      });
    }

    const salary = Number(daily_salary);

    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid daily salary is required'
      });
    }

    const { data, error } = await supabase
      .from('staff')
      .insert({
        name: name.trim(),
        role: role?.trim() || 'Staff',
        phone: phone?.trim() || null,
        daily_salary: salary,
        active: active !== false
      })
      .select(`
        id,
        name,
        role,
        phone,
        daily_salary,
        active
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      staff: data
    });

  } catch (error) {
    console.error('Add staff error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ========================================
// UPDATE STAFF
// ========================================
async function updateStaff(req, res) {
  try {

    const { id } = req.params;

    const {
      name,
      role,
      phone,
      daily_salary,
      active
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Staff id is required'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Staff name is required'
      });
    }

    const salary = Number(daily_salary);

    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid daily salary is required'
      });
    }

    const { data, error } = await supabase
      .from('staff')
      .update({
        name: name.trim(),
        role: role?.trim() || 'Staff',
        phone: phone?.trim() || null,
        daily_salary: salary,
        active: active !== false
      })
      .eq('id', id)
      .select(`
        id,
        name,
        role,
        phone,
        daily_salary,
        active
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      staff: data
    });

  } catch (error) {
    console.error('Update staff error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ========================================
// DELETE / DEACTIVATE STAFF
// ========================================
async function deleteStaff(req, res) {
  try {

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Staff id is required'
      });
    }

    // We deactivate instead of physically deleting.
    // This keeps attendance and salary history safe.
    const { data, error } = await supabase
      .from('staff')
      .update({
        active: false
      })
      .eq('id', id)
      .select(`
        id,
        name,
        role,
        phone,
        daily_salary,
        active
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      staff: data
    });

  } catch (error) {
    console.error('Delete staff error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getStaff,
  getTodayStaff,
  markAttendance,
  saveDailySalary,
  markSalaryPaid,
  addStaff,
  updateStaff,
  deleteStaff
};
