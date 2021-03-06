import numpy as np

from bokeh.io import curdoc, show
from bokeh.models import ColumnDataSource, Grid, LinearAxis, Patch, Plot

N = 30
x1 = np.linspace(-2, 2, N)
x2 = x1[::-1]
y1 = x1**2
y2 = x2**2 + (x2+2.2)
x = np.hstack((x1, x2))
y = np.hstack((y1, y2))

source = ColumnDataSource(dict(x=x, y=y))

plot = Plot(
    title=None, width=300, height=300,
    min_border=0, toolbar_location=None)

glyph = Patch(x="x", y="y", fill_color="#a6cee3")
plot.add_glyph(source, glyph)

xaxis = LinearAxis()
plot.add_layout(xaxis, 'below')

yaxis = LinearAxis()
plot.add_layout(yaxis, 'left')

plot.add_layout(Grid(dimension=0, ticker=xaxis.ticker))
plot.add_layout(Grid(dimension=1, ticker=yaxis.ticker))

curdoc().add_root(plot)

show(plot)
