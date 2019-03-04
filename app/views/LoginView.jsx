import React, { Component } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Formik } from 'formik';
import Joi from 'joi';
import { withRouter } from 'react-router-dom';
import { Input, Labeled } from '../components/Input';
import RedmineAPI from '../redmine/api.js';
import storage from '../../common/storage';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 10px;
  grid-auto-rows: 200px;
  grid-template-areas:
    '. a a .'
    '. a a .';
`;

class LoginView extends Component {
  constructor(props) {
    super(props);
    const userData = storage.get('user');
    if (userData) {
      RedmineAPI.initialize(userData.redmineDomain).login({ token: userData.api_key });
      props.history.push('/app');
    }
  }

  validate = ({ username, password, redmineDomain }) => {
    const errors = {
      username: Joi.validate(username, Joi.string().required()),
      password: Joi.validate(password, Joi.string().required()),
      redmineDomain: Joi.validate(redmineDomain, Joi.string().uri().required())
    };
    const results = {};
    for (const [prop, validation] of Object.entries(errors)) {
      if (validation.error) {
        results[prop] = validation.error.message;
      }
    }
    return results;
  };

  onSubmit = (values, { setSubmitting, setFieldError }) => {
    const api = RedmineAPI.initialize(values.redmineDomain);
    api.login(values).then(({ data, error }) => {
      if (error) {
        setFieldError('request', error.explanation || error.message);
        
      } else {
        const user = _.get(data, 'user');
        if (user) {
          storage.set('user', {
            redmineDomain: values.redmineDomain,
            ..._.pick(user, 'id', 'firstname', 'lastname', 'api_key')
          });
          this.props.history.push('/app');
        }
      }
      setSubmitting(false);
    });
  }

  render() {
    return (
      <Grid>
        <Formik
          initialValues={{ username: '', password: '', redmineDomain: '' }}
          validate={this.validate}
          onSubmit={this.onSubmit}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting
          }) => (
            <form onSubmit={handleSubmit}>
              <Labeled
                label="Login"
                htmlFor="username"
              >
                <Input
                  type="text"
                  name="username"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.username}
                />
              </Labeled>
              {errors.username && touched.username && (<div>{errors.username}</div>) }
              <Labeled
                label="Password"
                htmlFor="password"
              >
                <Input
                  type="password"
                  name="password"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.password}
                />
              </Labeled>
              {errors.password && touched.password && (<div>{errors.password}</div>) }
              <Labeled
                label="Remdine Host"
                htmlFor="redmineDomain"
              >
                <Input
                  name="redmineDomain"
                  placeholder="https://redmine.example.com"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.host}
                />
              </Labeled>
              {errors.redmineDomain && touched.redmineDomain && (<div>{errors.redmineDomain}</div>) }
              <button type="submit" disabled={isSubmitting}>
              Submit
              </button>
              {errors.request && (<div>{errors.request}</div>) }
            </form>
          )}
        </Formik>
      </Grid>
    );
  }
}

export default withRouter(LoginView);
