import React from 'react';
import ReactDOM from 'react-dom';
import Markdown from './index';

class TryItLive extends React.PureComponent {
    state = {markdown: document.getElementById('sample-content').textContent.trim()}

    updateState = (e) => this.setState({markdown: e.target.value})

    render() {
        return (
            <main>
                <header>
                    <a target='_blank' href='https://github.com/yaycmyk/markdown-to-jsx' title='Check out the markdown-to-jsx source code'>
                        <img src='./images/logo.svg' alt='markdown-to-jsx logo' />
                    </a>

                    <p className='description'><code>markdown-to-jsx</code> is a no-fuss compiler that takes Github-flavored Markdown (GFM)<br /> and forms it into renderable React content without the need for <code>dangerouslySetInnerHTML</code>.</p>

                    <p className='learn-more'>See the <a target='_blank' href='https://github.com/yaycmyk/markdown-to-jsx/blob/master/README.md'>project README</a> for installation &amp; usage.</p>
                </header>

                <section className='content'>
                    <textarea
                        className='content-raw'
                        onChange={this.updateState}
                        value={this.state.markdown} />

                    <Markdown className='content-compiled'>
                        {this.state.markdown}
                    </Markdown>
                </section>
            </main>
        );
    }
}

ReactDOM.render(<TryItLive />, document.getElementById('root'));
