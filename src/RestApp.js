import axios from "axios";
import { OpenVidu } from "openvidu-browser";
import React, { Component, createRef } from "react";
import "./App.css";
import Messages from "./Messages";
import UserVideoComponent from "./UserVideoComponent";

// const OPENVIDU_SERVER_URL = "https://" + window.location.hostname + ":4443";
// const OPENVIDU_SERVER_SECRET = "MY_SECRET";
const OPENVIDU_SERVER_URL = "https://i7a306.p.ssafy.io/openvidu/api";
const OPENVIDU_SERVER_SECRET = "SYNERGY";

const SPRINGBOOT_SERVER_URL = "https://i7a306.p.ssafy.io:8080/api/channels";
// const SPRINGBOOT_SERVER_URL = "https://localhost:8080/api/channels";

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      mySessionId: "",
      myUserName: "",
      session: undefined,
      mainStreamManager: undefined,
      publisher: undefined,
      subscribers: [],
      // user need to hold their own connection.id
      myConnectionId: "",

      // audio, video
      audiostate: true,
      audioallowed: true,
      videostate: true,
      videoallowed: true,

      // chatting
      messages: [],
      message: "",

      joinLink: ""
    };

    this.joinSession = this.joinSession.bind(this);
    this.leaveSession = this.leaveSession.bind(this);
    this.switchCamera = this.switchCamera.bind(this);
    this.handleChangeSessionId = this.handleChangeSessionId.bind(this);
    this.handleChangeUserName = this.handleChangeUserName.bind(this);
    this.handleMainVideoStream = this.handleMainVideoStream.bind(this);
    this.onbeforeunload = this.onbeforeunload.bind(this);

    // chatting
    this.messageContainer = createRef(null);
    this.sendMessageByClick = this.sendMessageByClick.bind(this);
    this.sendMessageByEnter = this.sendMessageByEnter.bind(this);
    this.handleChatMessageChange = this.handleChatMessageChange.bind(this);

    // REST
    // client에서 springboot server로 방 생성을 위한 랜덤 sessionId 생성 요청
    this.createRandomSessionId = this.createRandomSessionId.bind(this);

    // session 생성 후 SpringBoot Server에 session 정보 저장
    this.recordParticipant = this.recordParticipant.bind(this);

    // 참가 링크 생성
    this.generateJoinLink = this.generateJoinLink.bind(this);

    this.reverseAudioState = this.reverseAudioState.bind(this);
    this.reverseVideoState = this.reverseVideoState.bind(this);
  }

  sendMessageByClick() {
    if (this.state.message !== "") {
      this.setState({
        messages: [
          ...this.state.messages,
          {
            userName: this.state.myUserName,
            text: this.state.message,
            boxClass: "messages__box--operator",
          },
        ],
      });
      const mySession = this.state.session;

      mySession.signal({
        data: `${this.state.myUserName},${this.state.message}`,
        to: [],
        type: "chat",
      });
    }

    this.setState({
      message: "",
    });
  }

  sendMessageByEnter(e) {
    if (e.key === "Enter") {
      if (this.state.message !== "") {
        this.setState({
          messages: [
            ...this.state.messages,
            {
              userName: this.state.myUserName,
              text: this.state.message,
              boxClass: "messages__box--operator",
            },
          ],
        });
        const mySession = this.state.session;

        mySession.signal({
          data: `${this.state.myUserName},${this.state.message}`,
          to: [],
          type: "chat",
        });

        this.setState({
          message: "",
        });
      }
    }
  }

  handleChatMessageChange(e) {
    this.setState({
      message: e.target.value,
    });
  }

  generateJoinLink() {
    const str = "https://i7a306.p.ssafy.io/join?channel="+this.state.mySessionId;
    this.state.joinLink = str;
    this.setState({joinLink : str});
  }
  // chatting

  componentDidMount() {
    window.addEventListener("beforeunload", this.onbeforeunload);
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.onbeforeunload);
  }

  onbeforeunload(event) {
    this.leaveSession();
  }

  handleChangeSessionId(e) {
    this.setState({
      mySessionId: e.target.value,
    });
  }

  handleChangeUserName(e) {
    this.setState({
      myUserName: e.target.value,
    });
  }

  handleMainVideoStream(stream) {
    if (this.state.mainStreamManager !== stream) {
      this.setState({
        mainStreamManager: stream,
      });
    }
  }

  deleteSubscriber(streamManager) {
    let subscribers = this.state.subscribers;
    let index = subscribers.indexOf(streamManager, 0);
    if (index > -1) {
      subscribers.splice(index, 1);
      this.setState({
        subscribers: subscribers,
      });
    }
  }

  reverseAudioState() {
    this.state.publisher.publishAudio(
      !this.state.audiostate
    );

    this.setState({
      audiostate: !this.state.audiostate
    });
  }

  reverseVideoState() {
    this.state.publisher.publishVideo(
      !this.state.videostate
    );
    
    this.setState({
      videostate: !this.state.videostate
    });
  }

  // SpringBoot Server로부터 무작위 세션 id 생성.
  createRandomSessionId() {
    return new Promise((resolve) => {
      axios.get(SPRINGBOOT_SERVER_URL + "/create", {
        hedaers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        // setState 호출 시 render도 호출 (https://velog.io/@lllen/React-%EC%9D%B4%EB%B2%A4%ED%8A%B8)
        console.log("created random sessionId");
        // this.mySessionId = response.data;
        
        console.log(response);
        this.state.mySessionId = response.data;
        this.setState({mySessionId: response.data});
        console.log("sessionId: "+this.state.mySessionId);
        resolve();
      });
    })
  }

  recordParticipant() {
    const requestBody = JSON.stringify({
      'connectionId' : this.state.myConnectionId,
      'userEmail' : "dummy email",
      'nickName' : this.state.myUserName,
    });
    console.log("put session id "+this.state.mySessionId);
    axios.put(SPRINGBOOT_SERVER_URL + "/" + this.state.mySessionId, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then((response) => {
      console.log(response);
    })
  }

  joinSession() {
    // --- 1) Get an OpenVidu object ---

    this.OV = new OpenVidu();

    // --- 2) Init a session ---

    this.setState(
      {
        session: this.OV.initSession(),
      },
      () => {
        var mySession = this.state.session;

        // --- 3) Specify the actions when events take place in the session ---

        // On every new Stream received...
        mySession.on("streamCreated", (event) => {
          // Subscribe to the Stream to receive it. Second parameter is undefined
          // so OpenVidu doesn't create an HTML video by its own
          var subscriber = mySession.subscribe(event.stream, undefined);
          var subscribers = this.state.subscribers;
          subscribers.push(subscriber);

          // Update the state with the new subscribers
          this.setState({
            subscribers: subscribers,
          });
        });

        // On every Stream destroyed...
        mySession.on("streamDestroyed", (event) => {
          // Remove the stream from 'subscribers' array
          this.deleteSubscriber(event.stream.streamManager);
        });

        // On every asynchronous exception...
        mySession.on("exception", (exception) => {
          console.warn(exception);
        });

        // chatting
        mySession.on("signal:chat", (event) => {
          let chatdata = event.data.split(",");
          if (chatdata[0] !== this.state.myUserName) {
            this.setState({
              messages: [
                ...this.state.messages,
                {
                  userName: chatdata[0],
                  text: chatdata[1],
                  boxClass: "messages__box--visitor",
                },
              ],
            });
          }
        });

        // --- 4) Connect to the session with a valid user token ---

        // 'getToken' method is simulating what your server-side should do.
        // 'token' parameter should be retrieved and returned by your own backend
        this.getToken().then((token) => {
          // First param is the token got from OpenVidu Server. Second param can be retrieved by every user on event
          // 'streamCreated' (property Stream.connection.data), and will be appended to DOM as the user's nickname
          mySession
            .connect(token, { clientData: this.state.myUserName })
            .then(async () => {
              var devices = await this.OV.getDevices();
              var videoDevices = devices.filter(
                (device) => device.kind === "videoinput"
              );

              // --- 5) Get your own camera stream ---

              // Init a publisher passing undefined as targetElement (we don't want OpenVidu to insert a video
              // element: we will manage it on our own) and with the desired properties
              let publisher = this.OV.initPublisher(undefined, {
                audioSource: undefined, // The source of audio. If undefined default microphone
                videoSource: undefined, // The source of video. If undefined default webcam
                publishAudio: true, // Whether you want to start publishing with your audio unmuted or not
                publishVideo: true, // Whether you want to start publishing with your video enabled or not
                resolution: "640x480", // The resolution of your video
                frameRate: 30, // The frame rate of your video
                insertMode: "APPEND", // How the video is inserted in the target element 'video-container'
                mirror: false, // Whether to mirror your local video or not
              });

              // --- 6) Publish your stream ---

              mySession.publish(publisher);

              // Set the main video in the page to display our webcam and store our Publisher
              this.setState({
                currentVideoDevice: videoDevices[0],
                mainStreamManager: publisher,
                publisher: publisher,
              });
            })
            .catch((error) => {
              console.log(
                "There was an error connecting to the session:",
                error.code,
                error.message
              );
            });
        });
      }
    );
  }

  leaveSession() {
    // --- 7) Leave the session by calling 'disconnect' method over the Session object ---

    const mySession = this.state.session;

    if (mySession) {
      mySession.disconnect();
    }

    // Empty all properties...
    this.OV = null;
    this.setState({
      session: undefined,
      subscribers: [],
      mySessionId: "",
      myUserName: "",
      mainStreamManager: undefined,
      publisher: undefined,
    });
  }

  async switchCamera() {
    try {
      const devices = await this.OV.getDevices();
      var videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices && videoDevices.length > 1) {
        var newVideoDevice = videoDevices.filter(
          (device) => device.deviceId !== this.state.currentVideoDevice.deviceId
        );

        if (newVideoDevice.length > 0) {
          // Creating a new publisher with specific videoSource
          // In mobile devices the default and first camera is the front one
          var newPublisher = this.OV.initPublisher(undefined, {
            videoSource: newVideoDevice[0].deviceId,
            publishAudio: true,
            publishVideo: true,
            mirror: true,
          });

          //newPublisher.once("accessAllowed", () => {
          await this.state.session.unpublish(this.state.mainStreamManager);

          await this.state.session.publish(newPublisher);
          this.setState({
            currentVideoDevice: newVideoDevice,
            mainStreamManager: newPublisher,
            publisher: newPublisher,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  render() {
    const mySessionId = this.state.mySessionId;
    const myUserName = this.state.myUserName;
    const messages = this.state.messages;

    return (
      <div className="container">
        {this.state.session === undefined ? (
          <div id="join">
            <div id="img-div">
              <img
                src="resources/images/openvidu_grey_bg_transp_cropped.png"
                alt="OpenVidu logo"
              />
            </div>
            <div id="join-dialog" className="jumbotron vertical-center">
              <h1> Creating a video session </h1>
              <form className="form-group" onSubmit={this.joinSession}>
                <p>
                  <label> NickName </label>
                  <input
                    className="form-control"
                    type="text"
                    id="userName"
                    value={myUserName}
                    onChange={this.handleChangeUserName}
                    required
                  />
                </p>
                {/* <p>
                  <label> Session </label>
                  <input
                    className="form-control"
                    type="text"
                    id="sessionId"
                    value={mySessionId}
                    onChange={this.handleChangeSessionId}
                    // required
                  />
                </p> */}
                <p className="text-center">
                  <input
                    className="btn btn-lg btn-success"
                    name="commit"
                    type="submit"
                    value="JOIN"
                  />
                </p>
              </form>
            </div>
          </div>
        ) : null}

        {this.state.session !== undefined ? (
          <div id="session">
            <div id="session-header">
              <h1 id="session-title">{mySessionId}</h1>
              <input
                className="btn btn-large btn-danger"
                type="button"
                id="buttonLeaveSession"
                onClick={this.leaveSession}
                value="Leave session"
              />
            </div>

            <div>
              <text>{this.state.joinLink}</text>
            </div>

            {this.state.mainStreamManager !== undefined ? (
              <div id="main-video" className="col-md-6">
                <UserVideoComponent
                  streamManager={this.state.mainStreamManager}
                />
                <input
                  className="btn btn-large btn-success"
                  type="button"
                  id="buttonSwitchCamera"
                  onClick={this.switchCamera}
                  value="Switch Camera"
                />
              </div>
            ) : null}
            <div id="video-container" className="col-md-6">
              {this.state.publisher !== undefined ? (
                <div
                  className="stream-container col-md-6 col-xs-6"
                  onClick={() =>
                    this.handleMainVideoStream(this.state.publisher)
                  }
                >
                  <UserVideoComponent streamManager={this.state.publisher} />
                </div>
              ) : null}
              {this.state.subscribers.map((sub, i) => (
                <div
                  key={i}
                  className="stream-container col-md-6 col-xs-6"
                  onClick={() => this.handleMainVideoStream(sub)}
                >
                  <UserVideoComponent streamManager={sub} />
                </div>
              ))}
            </div>
            <div>
              {this.state.audiostate ? (
                <button 
                  onClick={this.reverseAudioState}
                >
                  Audio Off
                </button>
              ) : (
                <button
                  onClick={this.reverseAudioState}
                >
                  Audio On
                </button>
              )}
            </div>
            <div>
            {this.state.videostate ? (
                <button 
                  onClick={this.reverseVideoState}
                >
                  Video Off
                </button>
              ) : (
                <button
                  onClick={this.reverseVideoState}
                >
                  Video On
                </button>
              )}
            </div>
            <div className="chatbox__footer">
              <input
                id="chat_message"
                type="text"
                placeholder="Write a message..."
                onChange={this.handleChatMessageChange}
                onKeyPress={this.sendMessageByEnter}
                value={this.state.message}
              />
              <button
                className="chatbox__send--footer"
                onClick={this.sendMessageByClick}
              >
                Enter
              </button>
            </div>
            <div className="chatbox__messages">
              <Messages messages={messages} />
              <div />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /**
   * --------------------------
   * SERVER-SIDE RESPONSIBILITY
   * --------------------------
   * These methods retrieve the mandatory user token from OpenVidu Server.
   * This behavior MUST BE IN YOUR SERVER-SIDE IN PRODUCTION (by using
   * the API REST, openvidu-java-client or openvidu-node-client):
   *   1) Initialize a Session in OpenVidu Server	(POST /openvidu/api/sessions)
   *   2) Create a Connection in OpenVidu Server (POST /openvidu/api/sessions/<SESSION_ID>/connection)
   *   3) The Connection.token must be consumed in Session.connect() method
   */

  getToken() {
    return this.createRandomSessionId().then(() => 
      this.createSession(this.state.mySessionId).then((sessionId) =>
        this.createToken(sessionId)
      )
    );
  }

  createSession(sessionId) {
    console.log("created session "+sessionId);
    return new Promise((resolve, reject) => {
      var data = JSON.stringify({ customSessionId: sessionId });
      axios
        .post(OPENVIDU_SERVER_URL + "/sessions", data, {
          headers: {
            Authorization:
              "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
            "Content-Type": "application/json",
          },
        })
        .then((response) => {
          console.log("CREATE SESSION", response);
          resolve(response.data.id);
        })
        .catch((response) => {
          var error = Object.assign({}, response);
          if (error?.response?.status === 409) {
            resolve(sessionId);
          } else {
            console.log(error);
            console.warn(
              "No connection to OpenVidu Server. This may be a certificate error at " +
                OPENVIDU_SERVER_URL
            );
            if (
              window.confirm(
                'No connection to OpenVidu Server. This may be a certificate error at "' +
                  OPENVIDU_SERVER_URL +
                  '"\n\nClick OK to navigate and accept it. ' +
                  'If no certificate warning is shown, then check that your OpenVidu Server is up and running at "' +
                  OPENVIDU_SERVER_URL +
                  '"'
              )
            ) {
              window.location.assign(
                OPENVIDU_SERVER_URL + "/accept-certificate"
              );
            }
          }
        });
    });
  }

  createToken(sessionId) {
    return new Promise((resolve, reject) => {
      var data = {};
      axios
        .post(
          OPENVIDU_SERVER_URL + "/sessions/" + sessionId + "/connection",
          data,
          {
            headers: {
              Authorization:
                "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
                "Content-Type": "application/json",
            },
          }
        )
        .then((response) => {
          console.log("TOKEN", response);
          resolve(response.data.token);
          console.log("connection id : "+response.data.id);
          this.state.myConnectionId = response.data.id;

          this.recordParticipant();
          this.generateJoinLink();
        })
        .catch((error) => reject(error));
    });
  }
}

export default App;
