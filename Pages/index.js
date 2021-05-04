// (function () {

//Imports and variables
const log = console.log;
let ob = {
    bids: [],
    asks: [],
    lastUpdateId: 0,
    symbol: '',
    buffer: [],
  },
  chart = '';

//socket
const socket = io.connect('/');
socket.on('connection', log('Socket connection established successfully!'));

socket.on('OBUPDATES', (pl) => {
  if (pl.s !== ob.symbol) return;
  if (!ob.lastUpdateId) {
    if (!ob.buffer.length) getSnapshot({ symbol: ob.symbol });
    ob.buffer = [...ob.buffer, pl];
  } else if (ob.lastUpdateId && ob.buffer.length) {
    //process buffer
    ob.buffer = [...ob.buffer, pl];
    const nextUpdateId = ob.lastUpdateId + 1;
    const fpidx = ob.buffer.findIndex(
      (d) => d.U <= nextUpdateId && d.u >= nextUpdateId
    );
    ob.buffer = ob.buffer.slice(fpidx);
    ob.buffer.forEach((d) => {
      const newBids = d.b.map((dd) => dd.map(Number));
      const newAsks = d.a.map((dd) => dd.map(Number));

      newBids.forEach((dd) => {
        const idx = ob.bids.findIndex((v) => v[0] === dd[0]);
        if (idx > -1) {
          ob.bids[idx] = dd;
        } else {
          ob.bids = [...ob.bids, dd];
        }
      });

      newAsks.forEach((dd) => {
        const idx = ob.asks.findIndex((v) => v[0] === dd[0]);
        if (idx > -1) {
          ob.asks[idx] = dd;
        } else {
          ob.asks = [...ob.asks, dd];
        }
      });

      ob.bids = ob.bids.filter((v) => v[1]).sort((a, b) => b[0] - a[0]);

      ob.asks = ob.asks.filter((v) => v[1]).sort((a, b) => a[0] - b[0]);

      ob.lastUpdateId = d.u;
    });
    ob.buffer = [];
  } else {
    //process real time
    if (pl.U != ob.lastUpdateId + 1) {
      log('Orderbook out of sync');
      return symbolchange();
    }

    const newBids = pl.b.map((dd) => dd.map(Number));
    const newAsks = pl.a.map((dd) => dd.map(Number));

    newBids.forEach((dd) => {
      const idx = ob.bids.findIndex((v) => v[0] === dd[0]);
      if (idx > -1) {
        ob.bids[idx] = dd;
      } else {
        ob.bids = [...ob.bids, dd];
      }
    });

    newAsks.forEach((dd) => {
      const idx = ob.asks.findIndex((v) => v[0] === dd[0]);
      if (idx > -1) {
        ob.asks[idx] = dd;
      } else {
        ob.asks = [...ob.asks, dd];
      }
    });

    ob.bids = ob.bids
      .filter((v) => v[1])
      .sort((a, b) => b[0] - a[0])
      .slice(0, 1000);
    ob.asks = ob.asks
      .filter((v) => v[1])
      .sort((a, b) => a[0] - b[0])
      .slice(0, 1000);
    ob.lastUpdateId = pl.u;
    chart.updateData(ob);
  }
});

//Helper functions
const getSnapshot = async ({ symbol }) => {
  try {
    const res = await fetch(
      `/serveapi?url=https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=1000`
    );
    const obsnapshot = await res.json();
    const { bids: bidsS, asks: asksS, lastUpdateId } = obsnapshot;
    const bids = bidsS.map((d) => d.map(Number));
    const asks = asksS.map((d) => d.map(Number));
    ob = {
      ...ob,
      bids,
      asks,
      lastUpdateId,
    };
    chart = new OrderBook({ bids, asks });
  } catch (err) {
    log(err);
    alert(err);
  }
};
const symbolchange = () => {
  const symbol = document.getElementById('symbol').value;
  ob = { bids: [], asks: [], lastUpdateId: 0, symbol, buffer: [] };
  if (chart) chart.destroy();
  socket.emit('SYMBOL', { symbol });
};

//Event listeners
document.getElementById('symbol').addEventListener('change', symbolchange);

//D3JS Chart Class
class OrderBook {
  constructor({ bids, asks }) {
    this.bids = [...bids];
    this.asks = [...asks];
    this.margin = { top: 20, left: 40, bottom: 20, right: 40 };
    this.colors = {
      bidAA: 'rgba(46, 204, 113,0.2)',
      askAA: 'rgba(239, 83, 80,0.2)',
      bidAL: 'rgba(46, 204, 113,1)',
      askAL: 'rgba(255, 0, 0,1)',
      bidAO: 'rgba(46, 204, 113,0.5)',
      askAO: 'rgba(239, 83, 80,0.5)',
      axisText: 'rgba(150,150,150,1)',
    };
    const svgDimensions = document
      .getElementsByTagName('svg')[0]
      .getBoundingClientRect();
    this.width = svgDimensions.width - this.margin.left - this.margin.right;
    this.height = svgDimensions.height - this.margin.top - this.margin.bottom;
    this.bidsA = bids.map((d, i) => [
      d[0],
      bids.slice(0, i + 1).reduce((a, dd) => a + dd[1], 0),
    ]);
    this.asksA = asks.map((d, i) => [
      d[0],
      asks.slice(0, i + 1).reduce((a, dd) => a + dd[1], 0),
    ]);
    this.xaxis = d3
      .scaleLinear()
      .domain([bids.slice(-1)[0][0], asks.slice(-1)[0][0]]) //min bid price, max ask price
      .range([0, this.width]);
    //Apply transformation on this axis
    this.cxaxis = d3
      .scaleLinear()
      .domain(this.xaxis.domain()) //min bid price, max ask price
      .range([0, this.width]);
    this.yaxisA = d3
      .scaleLinear()
      .domain([
        0,
        Math.max(this.bidsA.slice(-1)[0][1], this.asksA.slice(-1)[0][1]),
      ])
      .range([this.height, 0]);
    this.yaxisO = d3
      .scaleLinear([
        0,
        Math.max(...[...bids.map((d) => d[1]), ...asks.map((d) => d[1])]),
      ])
      .domain([0, Math.max(bids.slice(-1)[0][1], asks.slice(-1)[0][1])])
      .range([this.height, 0]);

    this.plotArea = d3
      .select('svg')
      .append('g')
      .attr('class', 'plotArea')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    //Plot Axis
    this.plotaxisx = this.plotArea
      .append('g')
      .attr('id', 'xaxis')
      .attr('transform', `translate(0,${this.height})`)
      .attr('color', this.colors.axisText)
      .call(d3.axisBottom(this.xaxis));

    this.plotaxisya1 = this.plotArea
      .append('g')
      .attr('id', 'yaxisa1')
      .attr('color', this.colors.axisText)
      .call(d3.axisLeft(this.yaxisA));

    this.plotaxisya2 = this.plotArea
      .append('g')
      .attr('id', 'yaxisa2')
      .attr('transform', `translate(${this.width},0)`)
      .attr('color', this.colors.axisText)
      .call(d3.axisRight(this.yaxisO));

    //Zoom function
    this.morect = this.plotArea
      .append('rect')
      .attr('fill', 'rgba(0,0,0,0)')
      .attr('class', 'zoomArea')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('x', 0)
      .attr('y', 0)
      .call(d3.zoom().on('zoom', this.zoomFn.bind(this)));
  }
  zoomFn() {
    const t = d3.event.transform;
    const newxaxis = t.rescaleX(this.cxaxis);
    this.xaxis.domain(newxaxis.domain());
    this.render();
  }
  render() {
    const nxaxisrange = this.xaxis.domain();
    const filterFn = (d) => d[0] >= nxaxisrange[0] && d[0] <= nxaxisrange[1];
    const tpbids = this.bids.filter(filterFn);
    const tpasks = this.asks.filter(filterFn);
    const tpbidsA = this.bidsA.filter(filterFn);
    const tpasksA = this.asksA.filter(filterFn);

    const shapeFn = (a, d, i, source) => {
      if (i < source.length - 1) {
        return [...a, d, [d[0], source[i + 1][1]]];
      } else {
        return [...a, d];
      }
    };

    const pbids = tpbids.reduce(shapeFn, []);
    const pasks = tpasks.reduce(shapeFn, []);
    const pbidsA = tpbidsA.reduce(shapeFn, []);
    const pasksA = tpasksA.reduce(shapeFn, []);

    //Update Y axis
    this.yaxisA.domain([
      0,
      Math.max(
        pbidsA.length ? pbidsA.slice(-1)[0][1] : 0,
        pasksA.length ? pasksA.slice(-1)[0][1] : 0
      ),
    ]);

    this.yaxisO.domain([
      0,
      Math.max(...[...pbids.map((d) => d[1]), ...pasks.map((d) => d[1])]),
    ]);

    this.plotaxisx.call(d3.axisBottom(this.xaxis));
    this.plotaxisya1.call(d3.axisLeft(this.yaxisA));
    this.plotaxisya2.call(d3.axisRight(this.yaxisO));

    const obArea = d3
      .area()
      .y0(this.yaxisA(0))
      .x((d) => this.xaxis(d[0]))
      .y1((d) => this.yaxisA(d[1]));

    const obBars = d3
      .area()
      .y0(this.yaxisO(0))
      .x((d) => this.xaxis(d[0]))
      .y1((d) => this.yaxisO(d[1]));

    const obLine = d3
      .line()
      .x((d) => this.xaxis(d[0]))
      .y((d) => this.yaxisA(d[1]));

    this.plotArea
      .selectAll(
        'path.bidsA,path.asksA,path.bidsL,path.asksL,path.bidsO,path.asksO'
      )
      .remove();

    // Area Plot
    this.plotArea
      .append('path')
      .attr('class', 'bidsA')
      .attr('fill', this.colors.bidAA)
      .attr('d', obArea(pbidsA));

    this.plotArea
      .append('path')
      .attr('class', 'asksA')
      .attr('fill', this.colors.askAA)
      .attr('d', obArea(pasksA));

    //Area Line
    this.plotArea
      .append('path')
      .attr('class', 'bidsL')
      .attr('stroke', this.colors.bidAL)
      .attr('fill', 'none')
      .attr('d', obLine(pbidsA));

    this.plotArea
      .append('path')
      .attr('class', 'asksL')
      .attr('stroke', this.colors.askAL)
      .attr('fill', 'none')
      .attr('d', obLine(pasksA));

    //Bars Plot
    this.plotArea
      .append('path')
      .attr('class', 'bidsO')
      .attr('fill', this.colors.bidAO)
      .attr('d', obBars(pbids));

    this.plotArea
      .append('path')
      .attr('class', 'asksO')
      .attr('fill', this.colors.askAO)
      .attr('d', obBars(pasks));
  }
  destroy() {
    d3.selectAll('.plotArea').remove();
  }
  updateData({ bids, asks }) {
    this.bids = [...bids];
    this.asks = [...asks];
    this.bidsA = bids.map((d, i) => [
      d[0],
      bids.slice(0, i + 1).reduce((a, dd) => a + dd[1], 0),
    ]);
    this.asksA = asks.map((d, i) => [
      d[0],
      asks.slice(0, i + 1).reduce((a, dd) => a + dd[1], 0),
    ]);
    this.render();
  }
}
// })();
