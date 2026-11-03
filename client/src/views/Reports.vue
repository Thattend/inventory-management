<template>
  <div class="reports">
    <div class="page-header">
      <div>
        <h2 class="page-title">Performance Reports</h2>
        <p class="page-description">View quarterly performance metrics and monthly trends</p>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading reports...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <!-- .page-sections owns the vertical rhythm (gap) so cards/grids need no ad-hoc margins -->
    <div v-else class="page-sections">
      <!-- Summary Stats: KPI tiles lead the page, matching the other views -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Revenue (YTD)</div>
          <div class="stat-value">${{ formatNumber(totalRevenue) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Monthly Revenue</div>
          <div class="stat-value">${{ formatNumber(avgMonthlyRevenue) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Orders (YTD)</div>
          <div class="stat-value">{{ totalOrders }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Best Performing Quarter</div>
          <div class="stat-value">{{ bestQuarter }}</div>
        </div>
      </div>
      <!-- Quarterly Performance -->
      <div class="card card--flush">
        <div class="card-header">
          <h3 class="card-title">Quarterly Performance</h3>
        </div>
        <div class="table-container">
          <table class="reports-table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th class="num">Total Orders</th>
                <th class="num">Total Revenue</th>
                <th class="num">Avg Order Value</th>
                <th class="num">Fulfillment Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in quarterlyData" :key="q.quarter">
                <td class="row-label">{{ q.quarter }}</td>
                <td class="num">{{ q.total_orders }}</td>
                <td class="num">${{ formatNumber(q.total_revenue) }}</td>
                <td class="num">${{ formatNumber(q.avg_order_value) }}</td>
                <td class="num">
                  <span :class="getFulfillmentClass(q.fulfillment_rate)">
                    {{ q.fulfillment_rate }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Monthly Trends Chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Monthly Revenue Trend</h3>
        </div>
        <div class="chart-container">
          <div class="bar-chart">
            <div v-for="month in monthlyData" :key="month.month" class="bar-wrapper">
              <div class="bar-container">
                <div
                  class="bar"
                  :style="{ height: getBarHeight(month.revenue) + 'px' }"
                  :title="'$' + formatNumber(month.revenue)"
                ></div>
              </div>
              <div class="bar-label">{{ formatMonth(month.month) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Month-over-Month Comparison -->
      <div class="card card--flush">
        <div class="card-header">
          <h3 class="card-title">Month-over-Month Analysis</h3>
        </div>
        <div class="table-container">
          <table class="reports-table">
            <thead>
              <tr>
                <th>Month</th>
                <th class="num">Orders</th>
                <th class="num">Revenue</th>
                <th class="num">Change</th>
                <th class="num">Growth Rate</th>
              </tr>
            </thead>
            <tbody>
              <!-- index is still needed to compare with the previous month; the key uses the unique month -->
              <tr v-for="(month, index) in monthlyData" :key="month.month">
                <td class="row-label">{{ formatMonth(month.month) }}</td>
                <td class="num">{{ month.order_count }}</td>
                <td class="num">${{ formatNumber(month.revenue) }}</td>
                <td class="num">
                  <span v-if="index > 0" :class="getChangeClass(month.revenue, monthlyData[index - 1].revenue)">
                    {{ getChangeValue(month.revenue, monthlyData[index - 1].revenue) }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="num">
                  <span v-if="index > 0" :class="getChangeClass(month.revenue, monthlyData[index - 1].revenue)">
                    {{ getGrowthRate(month.revenue, monthlyData[index - 1].revenue) }}
                  </span>
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Reports',
  data() {
    return {
      loading: true,
      error: null,
      quarterlyData: [],
      monthlyData: [],
      totalRevenue: 0,
      avgMonthlyRevenue: 0,
      totalOrders: 0,
      bestQuarter: ''
    }
  },
  mounted() {
    console.log('Reports component mounted')
    this.loadData()
  },
  methods: {
    async loadData() {
      console.log('Loading reports data...')
      try {
        this.loading = true

        // Fetch quarterly data
        console.log('Fetching quarterly data...')
        const quarterlyResponse = await axios.get('http://localhost:8001/api/reports/quarterly')
        this.quarterlyData = quarterlyResponse.data
        console.log('Quarterly data:', this.quarterlyData)

        // Fetch monthly data
        console.log('Fetching monthly data...')
        const monthlyResponse = await axios.get('http://localhost:8001/api/reports/monthly-trends')
        this.monthlyData = monthlyResponse.data
        console.log('Monthly data:', this.monthlyData)

        // Calculate summary stats
        console.log('Calculating summary stats...')
        this.calculateSummaryStats()
        console.log('Summary stats calculated')

      } catch (err) {
        console.log('Error loading reports:', err)
        this.error = 'Failed to load reports: ' + err.message
      } finally {
        this.loading = false
        console.log('Loading complete')
      }
    },

    calculateSummaryStats() {
      // Calculate total revenue
      var total = 0
      for (var i = 0; i < this.monthlyData.length; i++) {
        total = total + this.monthlyData[i].revenue
      }
      this.totalRevenue = total

      // Calculate average monthly revenue
      if (this.monthlyData.length > 0) {
        this.avgMonthlyRevenue = total / this.monthlyData.length
      } else {
        this.avgMonthlyRevenue = 0
      }

      // Calculate total orders
      var orders = 0
      for (var i = 0; i < this.monthlyData.length; i++) {
        orders = orders + this.monthlyData[i].order_count
      }
      this.totalOrders = orders

      // Find best quarter
      var bestQ = ''
      var bestRevenue = 0
      for (var i = 0; i < this.quarterlyData.length; i++) {
        if (this.quarterlyData[i].total_revenue > bestRevenue) {
          bestRevenue = this.quarterlyData[i].total_revenue
          bestQ = this.quarterlyData[i].quarter
        }
      }
      this.bestQuarter = bestQ
    },

    formatNumber(num) {
      console.log('Formatting number:', num)
      // Format number with commas
      var str = num.toString()
      var parts = str.split('.')
      var intPart = parts[0]
      var decPart = parts.length > 1 ? parts[1] : '00'

      var formatted = ''
      var count = 0
      for (var i = intPart.length - 1; i >= 0; i--) {
        if (count > 0 && count % 3 === 0) {
          formatted = ',' + formatted
        }
        formatted = intPart[i] + formatted
        count++
      }

      if (decPart.length === 1) {
        decPart = decPart + '0'
      }
      if (decPart.length > 2) {
        decPart = decPart.substring(0, 2)
      }

      return formatted + '.' + decPart
    },

    formatMonth(monthStr) {
      console.log('Formatting month:', monthStr)
      // Convert YYYY-MM to readable format
      var parts = monthStr.split('-')
      var year = parts[0]
      var month = parts[1]

      var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      var monthIndex = parseInt(month) - 1

      return monthNames[monthIndex] + ' ' + year
    },

    getBarHeight(revenue) {
      console.log('Calculating bar height for revenue:', revenue)
      // Calculate bar height (max height 200px)
      var maxRevenue = 0
      for (var i = 0; i < this.monthlyData.length; i++) {
        if (this.monthlyData[i].revenue > maxRevenue) {
          maxRevenue = this.monthlyData[i].revenue
        }
      }

      if (maxRevenue === 0) {
        return 0
      }

      var height = (revenue / maxRevenue) * 200
      return height
    },

    getFulfillmentClass(rate) {
      if (rate >= 90) {
        return 'badge success'
      } else if (rate >= 75) {
        return 'badge warning'
      } else {
        return 'badge danger'
      }
    },

    getChangeValue(current, previous) {
      var change = current - previous
      if (change > 0) {
        return '+$' + this.formatNumber(change)
      } else if (change < 0) {
        return '-$' + this.formatNumber(Math.abs(change))
      } else {
        return '$0.00'
      }
    },

    getChangeClass(current, previous) {
      var change = current - previous
      if (change > 0) {
        return 'positive-change'
      } else if (change < 0) {
        return 'negative-change'
      } else {
        return ''
      }
    },

    getGrowthRate(current, previous) {
      if (previous === 0) {
        return 'N/A'
      }

      var rate = ((current - previous) / previous) * 100
      var sign = rate > 0 ? '+' : ''

      return sign + rate.toFixed(1) + '%'
    }
  }
}
</script>

<style scoped>
/* Sections stacked with one consistent gap; shared margins are reset so they don't double up */
.page-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.page-sections > .stats-grid,
.page-sections > .card {
  margin-bottom: 0;
}

/* Bold first column replaces the old inline <strong> */
.row-label {
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.positive-change {
  color: var(--color-success-text);
  font-weight: var(--weight-semibold);
}
.negative-change {
  color: var(--color-danger-text);
  font-weight: var(--weight-semibold);
}

/* ---------- Monthly revenue bar chart ---------- */
.chart-container {
  padding: var(--space-4) var(--space-4) var(--space-2);
}
.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: var(--space-2);
  /* 200px plot + room for the rotated month labels below it */
  min-height: 260px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-12);
}
.bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 80px; /* chart geometry cap, not spacing: keeps bars slim on wide screens */
  position: relative;
}
.bar-container {
  /* must stay 200px: getBarHeight() returns pixel heights scaled to a 200px maximum */
  height: 200px;
  display: flex;
  align-items: flex-end;
  width: 100%;
}
.bar {
  width: 100%;
  background: var(--color-info);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.bar:hover {
  background: var(--color-primary-hover);
}
.bar-label {
  /* labels hang below the baseline, rotated so "Mon YYYY" fits under narrow bars */
  position: absolute;
  top: calc(100% + var(--space-4));
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  white-space: nowrap;
  transform: rotate(-45deg);
}
</style>
