import { darken, lighten, rgba } from 'polished';
import { injectGlobal } from 'preact-emotion';
import React from 'react';
import ReactDOM from 'react-dom';
import Markdown from './';

const COLOR_ACCENT = '#77667D';
const COLOR_BODY = '#444';

injectGlobal`
    *,
    *::before,
    *::after {
        box-sizing: border-box;
        outline-color: ${COLOR_ACCENT};
    }

    html,
    body,
    #root,
    main {
        margin: 0;
        min-height: 600px;
    }

    html {
        color: ${COLOR_BODY};
        font-family: 'Source Sans Pro', Helvetica Neue, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.5;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        margin: 0 0 1em;
    }

    h1 {
        font-size: 2rem;
    }

    h2 {
        font-size: 1.8rem;
    }

    h3 {
        font-size: 1.6rem;
    }

    h4 {
        font-size: 1.4rem;
    }

    h5 {
        font-size 1.2rem;
    }

    h6 {
        font-size: 1rem;
    }

    a {
        color: ${COLOR_ACCENT};
        transition: color 200ms ease;

        &:hover,
        &:focus {
            color: ${darken(0.5, COLOR_ACCENT)};
        }
    }

    code {
        background: ${rgba(COLOR_ACCENT, 0.2)};
        border: 1px solid ${rgba(COLOR_ACCENT, 0.3)};
        border-radius: 2px;
        display: inline-block;
        padding: 0 2px;
    }

    pre code {
        background: transparent;
        border: 0;
        display: block;
        padding: 1em;
    }

    main {
        display: flex;
        flex-direction: column;
        padding: 0 3em;
        margin: 3em 0 0;
    }

    header {
        flex-shrink: 0;
        margin-bottom: 2em;
        text-align: center;

        img {
            height: 100px;
        }
    }

    .content {
        display: flex;
        flex-grow: 1;
    }

    .content-compiled,
    .content-raw {
        flex: 0 0 50%;
        padding: 1em;
    }

    .content-compiled {
        overflow: auto;
        overflow-x: hidden;
        margin-left: 1em;
        max-height: 100vh;
    }

    .content-raw {
        border-color: ${COLOR_ACCENT};
        border-radius: 2px;
        position: sticky;
        top: 0;
        font-family: 'Source Code Pro', Consolas, Monaco, monospace;
        font-size: inherit;
        margin-right: 1em;
        max-height: 100vh;
    }

    .description {
        font-size: 18px;
    }

    .learn-more {
        color: ${lighten(0.3, COLOR_BODY)};
    }
`;

class TryItLive extends React.PureComponent {
    state = {markdown: document.getElementById('sample-content').textContent.trim()}

    updateState = (e) => this.setState({markdown: e.target.value})

    render () {
        return (
            <main>
                <header>
                    <a
                        target='_blank'
                        href='https://github.com/yaycmyk/markdown-to-jsx'
                        title='Check out the markdown-to-jsx source code'
                        rel='noopener noreferrer'>
                        <img src='./images/logo.svg' alt='markdown-to-jsx logo' />
                    </a>

                    <p className='description'><code>markdown-to-jsx</code> is a no-fuss compiler that takes Github-flavored Markdown (GFM)<br /> and forms it into renderable React content without the need for <code>dangerouslySetInnerHTML</code>.</p>

                    <p className='learn-more'>See the <a target='_blank' href='https://github.com/yaycmyk/markdown-to-jsx/blob/master/README.md' rel='noopener noreferrer'>project README</a> for installation &amp; usage.</p>
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
