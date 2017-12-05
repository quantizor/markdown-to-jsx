import { lighten, rgba } from 'polished';
import styled, { css, injectGlobal } from 'preact-emotion';
import React from 'react';
import ReactDOM from 'react-dom';
import Markdown from './';

class TryItLive extends React.PureComponent {
    state = {markdown: document.getElementById('sample-content').textContent.trim()}

    updateState = (e) => this.setState({markdown: e.target.value})

    render () {
        return (
            <main>
                <Header>
                    <a
                        target='_blank'
                        href='https://github.com/yaycmyk/markdown-to-jsx'
                        title='Check out the markdown-to-jsx source code'
                        rel='noopener noreferrer'>
                        <img src='./images/logo.svg' alt='markdown-to-jsx logo' />
                    </a>

                    <Description>
                        <code>markdown-to-jsx</code> is a no-fuss compiler that takes Github-flavored Markdown (GFM)<br /> and forms it into renderable React content without the need for <code>dangerouslySetInnerHTML</code>.
                    </Description>

                    <LearnMore>
                        See the <a target='_blank' href='https://github.com/yaycmyk/markdown-to-jsx/blob/master/README.md' rel='noopener noreferrer'>project README</a> for installation &amp; usage.
                    </LearnMore>
                </Header>

                <Content>
                    <Textarea
                        onInput={this.updateState}
                        value={this.state.markdown} />

                    <Compiled>
                        <Markdown options={options}>
                            {this.state.markdown}
                        </Markdown>
                    </Compiled>
                </Content>
            </main>
        );
    }
}

const COLOR_ACCENT = 'rgba(0, 0, 0, 0.5)';
const COLOR_BODY = '#444';

const spectrum = [
    '253, 128, 129',
    '253, 178, 131',
    '254, 232, 134',
];

const bands = spectrum.length;
const width = 100 / bands;
const transparent = spectrum.map((band, index) => `rgba(${band}, ${index === 0 ? 0.5 : 0.5 / index}) ${index * width * .8}%`).join(', ') + ', transparent 100%';

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
        background: linear-gradient(to bottom, ${transparent}) no-repeat;
        background-size: 100% 100vh;
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
            color: ${rgba(COLOR_ACCENT, 0.75)};
        }
    }

    code {
        background: ${rgba(COLOR_ACCENT, 0.05)};
        border: 1px solid ${rgba(COLOR_ACCENT, 0.1)};
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
`;

const Header = styled.header`
    flex-shrink: 0;
    margin-bottom: 2em;
    text-align: center;

    img {
        height: 100px;
    }
`;

const Description = styled.p`
    font-size: 18px;
`;

const LearnMore = styled.p`
    color: ${lighten(0.3, COLOR_BODY)};
`;

const sharedCss = css`
    flex: 0 0 50%;
    padding: 1em;
`;

const Content = styled.section`
    display: flex;
    flex-grow: 1;
`;

const Textarea = styled.textarea`
    ${sharedCss};
    border-color: ${COLOR_ACCENT};
    border-radius: 2px;
    position: sticky;
    top: 0;
    font-family: 'Source Code Pro', Consolas, Monaco, monospace;
    font-size: inherit;
    margin-right: 1em;
    max-height: 100vh;
`;

const Compiled = styled.div`
    ${sharedCss};
    overflow: auto;
    overflow-x: hidden;
    margin-left: 1em;
`;

const ShinyButton = styled.button`
    background: #444;
    color: #DDD;
    cursor: pointer;
    font: inherit;
    transition: background 200ms ease;

    &:hover,
    &:focus {
        background: #222;
    }

    &:active {
        background: #000;
    }
`;

function MyComponent (props) {
    return (
        <ShinyButton
            {...props}
            onClick={function () { alert('Look ma, I\'m a real component!'); }}
        />
    );
}

const options = {
    overrides: {
        MyComponent: {
            component: MyComponent,
        },
    },
};

ReactDOM.render(<TryItLive />, document.getElementById('root'));
