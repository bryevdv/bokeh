from bokeh.io import save
from bokeh.models import Circle, Column, ColumnDataSource, LinearAxis, Plot, Range1d

# Testing title rendering of background and border is covered in the
# label test. The title added to plot as the primary title
# should always be outside axes and other side renderers.

source = ColumnDataSource(data=dict(x=[1, 2], y=[1, 2]))

def make_plot(location, title_align, two_axes=True):
    plot = Plot(
        width=400, height=200,
        x_range=Range1d(0, 2), y_range=Range1d(0, 2),
        toolbar_location=None,
        title_location=location,
    )
    plot.title.text = "Title %s - %s" % (location, title_align)
    plot.title.align = title_align
    plot.add_glyph(source, Circle(x='x', y='y', radius=0.4))
    plot.add_layout(LinearAxis(), location)
    if two_axes:
        plot.add_layout(LinearAxis(), location)
    return plot

layout = Column(
    make_plot('above', 'left', two_axes=False),  # This is a workaround top doesn't like two axes
    make_plot('right', 'right'),
    make_plot('below', 'center'),
    make_plot('left', 'left')
)

save(layout)
